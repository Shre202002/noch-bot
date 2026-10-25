import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { findAccountById, readKnowledge, writeKnowledge } from '@/lib/storage';
import { getUserIdFromCookie } from '@/lib/auth';
import { requireVerifiedEmail } from '@/lib/emailVerification';
import { resolvePlanKey } from '@/lib/plans';
import { checkCrawlLimit, logCrawl, sameSite } from '@/lib/ratelimit';
import { runCrawl, CrawlPolicyError } from '@/lib/crawler';
import { canUpgradeCrawlPages, getCrawlBudget, normalizePlan } from '@/lib/crawler/budget';
import { acquireCrawlLock, releaseCrawlLock } from '@/lib/crawler/lock';
import { publishCrawl, type PublishFailureReason } from '@/lib/crawler/publish';
import { redactUrl, validateCrawlTarget } from '@/lib/crawler/urlPolicy';

// Crawl (≤35 s) + service grace (≤10 s) + embedding + Atlas readiness probe (≤20 s).
export const maxDuration = 90;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const POLICY_MESSAGES: Record<string, string> = {
  invalid_url: 'Please enter a valid website URL starting with http:// or https://.',
  blocked_destination: 'This address cannot be crawled. Please enter a public website URL.',
  dns_failed: 'We could not find that website. Check the URL and try again.',
};

const FAILURE_MESSAGES: Record<PublishFailureReason | 'robots_denied', string> = {
  robots_denied: "This website's robots.txt does not allow crawling.",
  no_content: 'No readable content was found on this website.',
  pages_failed: 'Some pages could not be fetched, so this crawl was not published.',
  embedding_failed: 'We could not finish indexing this crawl.',
  storage_failed: 'We could not finish indexing this crawl.',
  index_not_ready: 'We could not finish indexing this crawl.',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const correlationId = randomUUID().replace(/-/g, '').slice(0, 16);

  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401, headers: corsHeaders });
    }
    const unverified = await requireVerifiedEmail(userId, corsHeaders);
    if (unverified) return unverified;

    const body = await req.json().catch(() => ({}));
    let siteUrl: string;
    try {
      siteUrl = await validateCrawlTarget(body?.url);
    } catch (err) {
      if (err instanceof CrawlPolicyError) {
        return NextResponse.json(
          { error: POLICY_MESSAGES[err.reason] ?? POLICY_MESSAGES.invalid_url, reason: err.reason },
          { status: 400, headers: corsHeaders }
        );
      }
      throw err;
    }

    // ── Check crawl rate limit ────────────────────────────────
    const account = await findAccountById(userId);
    const plan = normalizePlan(await resolvePlanKey(account));

    // Re-crawling the site this account already has is unlimited; only a different website counts toward the limit.
    const current = await readKnowledge(userId);
    const recrawl = sameSite(current.url, siteUrl);
    const crawlCheck = await checkCrawlLimit(userId, plan);
    if (!crawlCheck.allowed && !recrawl) {
      return NextResponse.json(
        {
          error: `Monthly crawl limit reached (${crawlCheck.used}/${crawlCheck.limit}). Please upgrade your plan to crawl more websites.`,
          rateLimited: true,
          used: crawlCheck.used,
          limit: crawlCheck.limit,
        },
        { status: 429, headers: corsHeaders }
      );
    }

    if (!(await acquireCrawlLock(userId, correlationId))) {
      return NextResponse.json(
        { error: 'A crawl is already running for your account. Please wait for it to finish.' },
        { status: 409, headers: corsHeaders }
      );
    }

    try {
      return await crawlAndPublish({ userId, siteUrl, plan, crawlCheck, correlationId, recrawl });
    } finally {
      await releaseCrawlLock(userId, correlationId).catch((err) =>
        console.warn(`[crawl] cid=${correlationId} lock release failed:`, err?.message)
      );
    }
  } catch (err: any) {
    console.error(`[crawl] cid=${correlationId} fatal:`, err?.message);
    return NextResponse.json(
      { error: 'Crawl failed. Please try again.', correlationId },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function crawlAndPublish({
  userId,
  siteUrl,
  plan,
  crawlCheck,
  correlationId,
  recrawl,
}: {
  userId: string;
  siteUrl: string;
  plan: string;
  crawlCheck: { used: number; limit: number };
  correlationId: string;
  recrawl: boolean;
}) {
  const siteUrlRedacted = redactUrl(siteUrl);
  const budget = getCrawlBudget(plan);
  const existing = await readKnowledge(userId);
  const previousKnowledgeActive = Boolean(existing.activeGenerationId || existing.chunkCount);

  console.log(`[crawl] cid=${correlationId} start target=${siteUrlRedacted} plan=${plan} maxPages=${budget.maxPages}`);

  let crawlRun;
  try {
    crawlRun = await runCrawl(siteUrl, budget, correlationId);
  } catch (err) {
    if (err instanceof CrawlPolicyError) {
      return NextResponse.json(
        { error: POLICY_MESSAGES[err.reason] ?? POLICY_MESSAGES.invalid_url, reason: err.reason, correlationId },
        { status: 400, headers: corsHeaders }
      );
    }
    throw err;
  }
  const { result: crawl, fallbackUsed } = crawlRun;

  const published = await publishCrawl({ userId, siteUrl, siteUrlRedacted, crawl, correlationId, fallbackUsed });

  if (!published.ok) {
    const robotsBlockedAll =
      published.reason === 'no_content' &&
      crawl.pages.length > 0 &&
      crawl.pages.every((p) => p.reason === 'robots_denied');
    const reason = robotsBlockedAll ? 'robots_denied' : published.reason;

    await writeKnowledge(userId, {
      lastCrawl: {
        status: 'failed',
        at: new Date().toISOString(),
        correlationId,
        url: siteUrlRedacted,
        provider: crawl.provider,
        fallbackUsed,
        pagesIndexed: 0,
        chunks: 0,
        reason,
      },
    }).catch((err) => console.warn(`[crawl] cid=${correlationId} could not record failed attempt:`, err?.message));

    console.warn(`[crawl] cid=${correlationId} not published reason=${reason} provider=${crawl.provider}`);
    return NextResponse.json(
      {
        error: FAILURE_MESSAGES[reason],
        reason,
        previousKnowledgeActive,
        pages: published.pages,
        provider: crawl.provider,
        fallbackUsed,
        correlationId,
      },
      { status: 422, headers: corsHeaders }
    );
  }

  // Quota counts completed (published) crawls only, matching the previous behaviour;
  // the per-user crawl lock stops concurrent requests from slipping past the check.
  // Old pages were replaced by publishCrawl (new generation activated, inactive generations deleted).
  await logCrawl(userId, siteUrlRedacted, { recrawl });

  console.log(
    `[crawl] cid=${correlationId} published provider=${crawl.provider} fallback=${fallbackUsed} pages=${published.pagesIndexed} chunks=${published.chunks}`
  );

  const pagesCrawled = published.pages.filter((p) => p.reason !== 'robots_denied').length;
  return NextResponse.json(
    {
      success: true,
      pagesCrawled,
      pagesIndexed: published.pagesIndexed,
      chunks: published.chunks,
      characters: published.characters,
      pages: published.pages,
      pageLimit: budget.maxPages,
      capReached: crawl.capReached,
      deferredCount: crawl.deferredCount,
      upgradeSuggested: crawl.capReached && canUpgradeCrawlPages(plan),
      provider: crawl.provider,
      fallbackUsed,
      correlationId,
      crawlUsage: {
        used: crawlCheck.used + 1,
        limit: crawlCheck.limit,
        plan,
      },
    },
    { headers: corsHeaders }
  );
}
