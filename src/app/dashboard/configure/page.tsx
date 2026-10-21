
'use client';
import { useState, useEffect, useRef } from "react"
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  PopoverFooter,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Share2, Copy, Mail, MessageSquare, Check, Database, Zap } from 'lucide-react';
import { BasicColorPicker } from '@/components/ui/color-picker';
import { toast } from '@/hooks/use-toast';
import { ChatText } from '@/components/ChatText';

type Tab = 'Crawl' | 'Vectorize' | 'Theme' | 'Preview' | 'Embed Code'
const STEP_ORDER: Tab[] = ['Crawl', 'Vectorize', 'Theme', 'Preview', 'Embed Code']
type Message = { role: 'user' | 'assistant'; content: string }
type CrawlPageStatus = 'indexed' | 'fetched' | 'skipped' | 'blocked' | 'failed'
type CrawledPage = { url: string; title: string; status: CrawlPageStatus; reason: string | null; chunks: number }
type CrawlSummary = { pagesIndexed: number; chunks: number; capReached: boolean; pageLimit: number; upgradeSuggested: boolean; fallbackUsed: boolean }

const PAGE_STATUS_STYLE: Record<CrawlPageStatus, { label: string; color: string }> = {
  indexed: { label: 'Indexed', color: '#36f4a4' },
  fetched: { label: 'Fetched, not indexed', color: 'var(--nb-text-secondary)' },
  skipped: { label: 'Skipped', color: 'var(--nb-text-secondary)' },
  blocked: { label: 'Blocked', color: '#eab308' },
  failed: { label: 'Failed', color: '#ef4444' },
}

const PAGE_REASON_TEXT: Record<string, string> = {
  robots_denied: 'Not allowed by robots.txt',
  no_content: 'No readable text',
  http_error: 'Page returned an error',
  blocked_by_site: 'Site refused access',
  redirect_outside_origin: 'Redirects to another site',
  too_large: 'Page too large',
  unsupported_content: 'Not a web page',
  duplicate: 'Duplicate of another page',
  timeout: 'Timed out',
  too_many_redirects: 'Too many redirects',
  fetch_failed: 'Could not be fetched',
  blocked_destination: 'Address not allowed',
}

const FALLBACK_NOTICE = 'Scrapling was unavailable, so the legacy crawler handled this crawl.'
const FAILED_KEPT_PREVIOUS = 'Crawl failed. Your previously indexed website knowledge is still active. Check the URL and try again.'
const FAILED_NO_PREVIOUS = 'Crawl failed. Check the URL and try again.'

export default function ConfigurePage() {
  const [crawlUrl, setCrawlUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawledPages, setCrawledPages] = useState<CrawledPage[]>([])
  const [crawlSummary, setCrawlSummary] = useState<CrawlSummary | null>(null)
  const [pagesIndexed, setPagesIndexed] = useState(0)
  const [crawlDone, setCrawlDone] = useState(false)
  const [crawlError, setCrawlError] = useState('')
  const [crawlErrorDetail, setCrawlErrorDetail] = useState('')
  const [embedDone, setEmbedDone] = useState(false)
  const [chunkCount, setChunkCount] = useState(0)
  const [extractingTheme, setExtractingTheme] = useState(false)
  const [palette, setPalette] = useState<string[]>([])
  const [themeConfig, setThemeConfig] = useState({
    bubbleColor: '#36f4a4', headerColor: '#36f4a4',
    userMsgColor: '#36f4a4', sendBtnColor: '#36f4a4', accentColor: '#36f4a4',
  })
  // Step ticks from saved progress (GET /api/knowledge → setup), so they survive a reload.
  const [themeDone, setThemeDone] = useState(false)
  const [previewDone, setPreviewDone] = useState(false)
  const [embedInstalled, setEmbedInstalled] = useState(false)
  const markStepDone = (step: 'preview' | 'embed') => {
    if (step === 'preview') setPreviewDone(true)
    else setEmbedInstalled(true)
    fetch('/api/knowledge/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    }).catch(() => { /* the tick still shows for this visit */ })
  }
  const [previewMessages, setPreviewMessages] = useState<Message[]>([])
  const [previewInput, setPreviewInput] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('Crawl')
  const savedThemeRef = useRef<string | null>(null)
  // Direction of the last step change (1 forward, -1 back), so the panel enters from the side the organizer moved toward.
  const prevTabRef = useRef<Tab>('Crawl')
  const stepDirRef = useRef(1)
  if (prevTabRef.current !== activeTab) {
    stepDirRef.current = STEP_ORDER.indexOf(activeTab) >= STEP_ORDER.indexOf(prevTabRef.current) ? 1 : -1
    prevTabRef.current = activeTab
  }
  const [userId, setUserId] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [copiedShareUrl, setCopiedShareUrl] = useState(false)
  const previewBottomRef = useRef<HTMLDivElement>(null)

  const [previewTypingText, setPreviewTypingText] = useState('')
  const [previewIsTyping, setPreviewIsTyping] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.id) setUserId(d.id) })
    setBaseUrl(window.location.origin)
    fetch('/api/knowledge').then(r => r.json()).then(d => {
      if (d.url) { setCrawlUrl(d.url); setCrawlDone(true); setEmbedDone(true) }
      if (d.theme) {
        setThemeConfig(d.theme)
        savedThemeRef.current = JSON.stringify(d.theme)
      }
      if (d.setup) {
        setThemeDone(Boolean(d.setup.themeSaved))
        setPreviewDone(Boolean(d.setup.previewTested))
        setEmbedInstalled(Boolean(d.setup.embedInstalled))
      }
      if (d.palette) setPalette(d.palette)
      if (d.chunkCount) setChunkCount(d.chunkCount)
      if (d.pagesIndexed) setPagesIndexed(d.pagesIndexed)
    })
  }, [])

  useEffect(() => { previewBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [previewMessages])

  const startCrawl = async () => {
    if (!crawlUrl.trim() || crawling) return
    // A previous successful crawl stays active until a new one is published.
    const hadKnowledge = crawlDone || chunkCount > 0
    setCrawling(true)
    setCrawledPages([])
    setCrawlSummary(null)
    setCrawlError('')
    setCrawlErrorDetail('')

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: crawlUrl.trim() }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setCrawlError((data.previousKnowledgeActive ?? hadKnowledge) ? FAILED_KEPT_PREVIOUS : FAILED_NO_PREVIOUS)
        setCrawlErrorDetail([data.error, data.fallbackUsed ? FALLBACK_NOTICE : ''].filter(Boolean).join(' '))
        setCrawledPages(data.pages || [])
        return
      }

      setCrawledPages(data.pages || [])
      setCrawlSummary({
        pagesIndexed: data.pagesIndexed || 0,
        chunks: data.chunks || 0,
        capReached: !!data.capReached,
        pageLimit: data.pageLimit || 0,
        upgradeSuggested: !!data.upgradeSuggested,
        fallbackUsed: !!data.fallbackUsed,
      })
      setCrawlDone(true)
      setEmbedDone(true)
      setChunkCount(data.chunks || 0)
      setPagesIndexed(data.pagesIndexed || 0)

    } catch {
      setCrawlError(hadKnowledge ? FAILED_KEPT_PREVIOUS : FAILED_NO_PREVIOUS)
    } finally {
      setCrawling(false)
    }
  }

  const extractTheme = async () => {
    if (!crawlUrl) return
    setExtractingTheme(true)
    try {
      const res = await fetch('/api/extract-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: crawlUrl }),
      })
      const data = await res.json()
      if (data.palette?.length > 0) {
        setPalette(data.palette)
        const primary = data.palette[0]
        setThemeConfig({
          bubbleColor: primary, headerColor: primary,
          userMsgColor: primary, sendBtnColor: primary,
          accentColor: data.palette[1] || primary,
        })
      }
    } catch (err) {
      console.error('Theme extraction failed:', err)
    } finally {
      setExtractingTheme(false)
    }
  }

  // The theme saves itself when the organizer leaves the Theme step (Next, another tab, or leaving the page);
  // nothing is sent when the colours are unchanged since the last save.
  const latestThemeRef = useRef(themeConfig)
  latestThemeRef.current = themeConfig
  const saveTheme = async () => {
    const theme = latestThemeRef.current
    const serialized = JSON.stringify(theme)
    if (serialized === savedThemeRef.current) return
    try {
      const res = await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
        keepalive: true,
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      savedThemeRef.current = serialized
      setThemeDone(true)
    } catch (err) {
      console.error('Save theme failed:', err)
      toast({ variant: 'destructive', title: "Theme wasn't saved", description: 'Go back to the Theme step to try again.' })
    }
  }
  useEffect(() => {
    if (activeTab !== 'Theme') return
    return () => { void saveTheme() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const sendPreviewMessage = async (text?: string) => {
    const userText = text || previewInput.trim();

    if (!userText || previewLoading || previewIsTyping || !userId) {
      return;
    }

    const newMessages: Message[] = [
      ...previewMessages,
      { role: "user", content: userText },
    ];

    setPreviewMessages(newMessages);
    setPreviewInput("");
    setPreviewLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
          userId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setPreviewLoading(false);

      if (!res.ok || data.error || !data.text) {
        const reason = data.rateLimited
          ? "Message limit reached for your plan."
          : data.error || `Request failed (${res.status})`;
        setPreviewMessages([...newMessages, { role: "assistant", content: "⚠️ " + reason }]);
        return;
      }

      setPreviewIsTyping(true);
      let streamedText = "";
      const fullResponse = data.text || "";
      
      let i = 0;
      const interval = setInterval(() => {
        streamedText = fullResponse.slice(0, i + 1);
        setPreviewTypingText(streamedText);
        i++;
        if (i >= fullResponse.length) {
          clearInterval(interval);
          setPreviewMessages([...newMessages, { role: "assistant", content: fullResponse }]);
          if (!previewDone) markStepDone('preview');
          setPreviewTypingText("");
          setPreviewIsTyping(false);
        }
      }, 12);

    } catch (err: any) {
      setPreviewLoading(false);
      setPreviewIsTyping(false);
      setPreviewMessages([...newMessages, { role: "assistant", content: "⚠️ Error: " + err.message }]);
    }
  };

  const scriptUrl = `${baseUrl}/embed.js`;
  const embedCode = `<script\n  src="${scriptUrl}"\n  data-user-id="${userId}"\n  defer>\n</script>`;

  const THEME_COMPONENTS = [
    { key: 'bubbleColor', label: 'Chat Bubble', desc: 'Floating button color' },
    { key: 'headerColor', label: 'Header Bar', desc: 'Top bar of chat window' },
    { key: 'userMsgColor', label: 'User Messages', desc: 'Sent message bubbles' },
    { key: 'sendBtnColor', label: 'Send Button', desc: 'Send arrow button' },
    { key: 'accentColor', label: 'Accent / Links', desc: 'Hover states and links' },
  ] as const

  const PRESET_COLORS = ['#36f4a4', '#2563eb', '#8b5cf6', '#FF5701', '#ec4899', '#ef4444', '#eab308', '#ffffff']

  const shareOptions = [
    {
      name: 'Copy Link',
      icon: Copy,
      action: () => {
        navigator.clipboard.writeText(scriptUrl);
        setCopiedShareUrl(true);
        setTimeout(() => setCopiedShareUrl(false), 2000);
      },
    },
    { 
      name: 'Email', 
      icon: Mail, 
      action: () => {
        const subject = encodeURIComponent("Nochq AI Chatbot Integration Script");
        const body = encodeURIComponent(
          `Hi,\n\nHere is the integration script for the Nochq AI chatbot. Paste this snippet before the closing </body> tag on your website:\n\n${embedCode}\n\nDocumentation: ${baseUrl}/docs`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      } 
    },
    { 
      name: 'Message', 
      icon: MessageSquare, 
      action: async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Nochq AI Chatbot',
              text: `Integration script for Nochq AI: ${embedCode}`,
              url: scriptUrl,
            });
          } catch (err) {
            // User cancelled or share failed
          }
        } else {
          // Fallback: copy code to clipboard
          navigator.clipboard.writeText(embedCode);
          markStepDone('embed');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } 
    },
  ];

  return (
    <div className="py-2 md:py-6 lg:px-6 xl:px-10" style={{ maxWidth: 960, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes typingPulse { 0%,60%,100% { opacity: .35; } 30% { opacity: 1; } }
        .nb-focus:focus-visible, .nb-focus-within:focus-within { outline: 2px solid #36f4a4; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .nb-motion, .nb-motion * { animation: none !important; } }
        @keyframes cursorBlink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
        /* Step progression: the panel arrives from the direction of travel; a completed step's check settles in. */
        @keyframes nbStepIn { from { opacity: 0; transform: translateX(calc(var(--nb-step-dir, 1) * 16px)); } to { opacity: 1; transform: none; } }
        @keyframes nbCheckIn { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: none; } }
        @keyframes nbRowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes nbFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .nb-step-panel { animation: nbStepIn 260ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .nb-check-in { animation: nbCheckIn 220ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .nb-row-in { animation: nbRowIn 240ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          /* Keep the change legible as a short fade, without spatial movement or stagger. */
          .nb-step-panel, .nb-check-in, .nb-row-in { animation: nbFadeIn 150ms ease-out both; animation-delay: 0ms !important; }
        }
      `}</style>

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 400, color: '#fff', letterSpacing: '-0.9px', marginBottom: 6 }}>Configure</h1>
        <p style={{ fontSize: 14, color: 'var(--nb-text-secondary)' }}>Set up your AI chatbot step by step.</p>
      </div>

      <nav aria-label="Setup steps" style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { tab: 'Crawl', done: crawlDone, label: '1. Crawl' },
          { tab: 'Vectorize', done: embedDone, label: '2. Vectorize' },
          { tab: 'Theme', done: themeDone, label: '3. Theme' },
          { tab: 'Preview', done: previewDone, label: '4. Preview' },
          { tab: 'Embed Code', done: embedInstalled, label: '5. Embed' },
        ].map(({ tab, done, label }) => (
          <button key={tab} type="button" className="nb-focus" onClick={() => setActiveTab(tab as Tab)}
            aria-current={activeTab === tab ? 'step' : undefined}
            aria-label={`${label}${done ? ' (completed)' : ''}`}
            style={{
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 36,
            padding: '6px 14px', borderRadius: 9999, cursor: 'pointer', font: 'inherit',
            background: activeTab === tab ? '#36f4a420' : 'transparent',
            border: activeTab === tab ? '1px solid #36f4a4' : '1px solid #2a2d35',
            color: activeTab === tab ? '#36f4a4' : done ? 'var(--nb-text-secondary)' : 'var(--nb-text-tertiary)',
            fontSize: 13, transition: 'all 0.15s'
          }}>
            {done && <Check aria-hidden="true" className="nb-check-in h-3.5 w-3.5" style={{ color: '#36f4a4' }} />}
            {label}
          </button>
        ))}
      </nav>

      <div style={{ background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 16, padding: 'clamp(16px, 4vw, 32px)', overflow: 'hidden' }}>
        <div key={activeTab} className="nb-step-panel" style={{ ['--nb-step-dir' as string]: stepDirRef.current }}>
        {activeTab === 'Crawl' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 600, lineHeight: '28px', marginBottom: 6 }}>Step 1 — Crawl Your Website</h2>
              <p style={{ fontSize: 14, color: 'var(--nb-text-secondary)' }}>Enter your website URL. Nochq will crawl your most useful pages and index their content for your chatbot.</p>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); startCrawl() }}
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="crawl-url" style={{ fontSize: 12, color: 'var(--nb-text-secondary)' }}>Website URL</label>
                <input
                  id="crawl-url"
                  type="url"
                  inputMode="url"
                  value={crawlUrl}
                  onChange={e => setCrawlUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  disabled={crawling}
                  style={{ width: '100%', background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 8, padding: '12px 16px', color: '#fff', fontSize: 14 }}
                />
              </div>
              <button type="submit" disabled={crawling || !crawlUrl.trim()} style={{
                background: crawling ? '#2a2d35' : '#36f4a4', color: crawling ? 'var(--nb-text-secondary)' : '#000',
                border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 600,
                fontSize: 14, cursor: crawling || !crawlUrl.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap'
              }}>
                {crawling ? (
                  <><span aria-hidden="true" className="motion-reduce:[animation:none]" style={{ width: 14, height: 14, border: '2px solid #7d8187', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Crawling Website…</>
                ) : crawlDone ? 'Re-crawl Website' : 'Start Website Crawl'}
              </button>
            </form>

            {crawlDone && !crawling && (
              <p style={{ fontSize: 13, color: 'var(--nb-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Re-crawling updates your current website data: the old pages are replaced once the new crawl finishes.
                Re-crawling the same site doesn&apos;t count toward your monthly crawl limit.
              </p>
            )}

            <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {crawling && (
                <p style={{ fontSize: 14, color: 'var(--nb-text-secondary)' }}>Crawling and indexing your website. This can take up to a minute.</p>
              )}

              {!crawling && !crawlDone && !crawlError && crawledPages.length === 0 && (
                <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>No pages crawled yet</div>
                  <div style={{ fontSize: 14, color: 'var(--nb-text-secondary)', marginTop: 4 }}>Enter a website URL to build or refresh your chatbot&apos;s knowledge.</div>
                </div>
              )}

              {crawlSummary && (
                <div style={{ fontSize: 14, color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
                  <span><strong style={{ fontSize: 28, lineHeight: '32px', fontWeight: 600 }}>{crawlSummary.pagesIndexed}</strong> {crawlSummary.pagesIndexed === 1 ? 'page' : 'pages'} indexed</span>
                  <span style={{ color: 'var(--nb-text-secondary)' }}>·</span>
                  <span><strong style={{ fontSize: 28, lineHeight: '32px', fontWeight: 600 }}>{crawlSummary.chunks}</strong> {crawlSummary.chunks === 1 ? 'chunk' : 'chunks'} added</span>
                </div>
              )}

              {crawlSummary?.capReached && (
                <div style={{ border: '1px solid #eab308', borderRadius: 8, padding: '12px 16px', color: '#eab308', fontSize: 14 }}>
                  ⚠ Crawled {crawlSummary.pageLimit} pages.{' '}
                  {crawlSummary.upgradeSuggested
                    ? <>For more, <a href="/dashboard/account" style={{ color: '#eab308', textDecoration: 'underline' }}>Upgrade your plan</a>.</>
                    : 'Your plan\'s page limit was reached.'}
                </div>
              )}

              {crawlSummary?.fallbackUsed && (
                <div style={{ border: '1px solid #eab308', borderRadius: 8, padding: '12px 16px', color: '#eab308', fontSize: 14 }}>
                  ⚠ {FALLBACK_NOTICE}
                </div>
              )}

              {crawledPages.length > 0 && (
                <section aria-labelledby="crawled-pages-heading">
                  <h3 id="crawled-pages-heading" style={{ fontSize: 12, color: 'var(--nb-text-secondary)', marginBottom: 8, fontWeight: 400 }}>
                    Crawled Pages ({crawledPages.length})
                  </h3>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
                    {crawledPages.map((page, i) => {
                      const status = PAGE_STATUS_STYLE[page.status] ?? PAGE_STATUS_STYLE.skipped
                      return (
                        <li key={`${page.url}-${i}`} className="nb-row-in" style={{ animationDelay: `${Math.min(i, 8) * 35}ms`, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, padding: '8px 16px', background: '#0a0a0a', borderRadius: 8, border: '1px solid #2a2d35' }}>
                          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                            {page.title && <div style={{ fontSize: 14, color: '#fff', overflowWrap: 'anywhere' }}>{page.title}</div>}
                            <div style={{ fontSize: 12, color: 'var(--nb-text-secondary)', fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{page.url}</div>
                            {page.reason && page.status !== 'indexed' && (
                              <div style={{ fontSize: 12, color: 'var(--nb-text-secondary)' }}>{PAGE_REASON_TEXT[page.reason] ?? 'Not indexed'}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, fontSize: 12 }}>
                            <span style={{ color: status.color, border: `1px solid ${status.color}`, borderRadius: 4, padding: '0 8px' }}>
                              {page.status === 'indexed' ? '✓ ' : page.status === 'failed' ? '✕ ' : ''}{status.label}
                            </span>
                            <span style={{ color: 'var(--nb-text-secondary)' }}>{page.chunks} {page.chunks === 1 ? 'chunk' : 'chunks'}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
            </div>

            {crawlError && (
              <div role="alert" style={{ background: '#1a0a0a', border: '1px solid #ef4444', borderRadius: 8, padding: 16, color: '#ef4444', fontSize: 14 }}>
                ✕ {crawlError}
                {crawlErrorDetail && <div style={{ marginTop: 4, color: 'var(--nb-text-secondary)', fontSize: 12 }}>{crawlErrorDetail}</div>}
              </div>
            )}

            {crawlDone && !crawling && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setActiveTab('Vectorize')} style={{ background: '#36f4a4', color: '#000', border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Review Indexed Content →</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Vectorize' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 2 — Vector Database Status</h2>
              <p style={{ fontSize: 14, color: 'var(--nb-text-secondary)' }}>Your website content has been chunked and converted into high-dimensional vectors for AI retrieval.</p>
            </div>

            {!embedDone ? (
              <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, padding: 32, textAlign: 'center' }}>
                <Database className="h-12 w-12 text-[color:var(--nb-text-tertiary)] mx-auto mb-4" />
                <p style={{ color: 'var(--nb-text-secondary)', fontSize: 14 }}>No vector data found. Please complete the Crawl step first.</p>
                <button onClick={() => setActiveTab('Crawl')} style={{ marginTop: 16, background: 'transparent', border: '1px solid #36f4a4', color: '#36f4a4', borderRadius: 9999, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>Go to Crawl</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', gap: 24, background: '#0d2420', border: '1px solid #36f4a430', borderRadius: 12, padding: 32 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#36f4a4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>Chunks Indexed</div>
                    <div style={{ fontSize: 48, color: '#fff', fontWeight: 300, lineHeight: 1 }}>{chunkCount}</div>
                    <div style={{ fontSize: 13, color: 'var(--nb-text-secondary)', marginTop: 8 }}>Individual knowledge units</div>
                  </div>
                  <div style={{ width: 1, background: '#36f4a420' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#36f4a4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>Pages Processed</div>
                    <div style={{ fontSize: 48, color: '#fff', fontWeight: 300, lineHeight: 1 }}>{pagesIndexed || (crawlDone ? '...' : 0)}</div>
                    <div style={{ fontSize: 13, color: 'var(--nb-text-secondary)', marginTop: 8 }}>Unique URLs vectorized</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: 12 }}>
                    <div style={{ background: '#36f4a4', color: '#000', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap className="h-3 w-3 fill-current" /> Stored in MongoDB Atlas
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--nb-text-secondary)' }}>Distance Metric: Cosine</span>
                  </div>
                </div>

                <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, padding: 20 }}>
                  <h3 style={{ fontSize: 13, color: '#fff', marginBottom: 12, fontWeight: 500 }}>Database Optimization</h3>
                  <p style={{ fontSize: 13, color: 'var(--nb-text-secondary)', lineHeight: 1.6 }}>
                    Your data is currently indexed in our primary <strong>NochBot</strong> collection. 
                    This ensures sub-100ms retrieval times during chat sessions. 
                    If you update your website, we recommend re-crawling to sync the latest content.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 12 }}>
                  <button onClick={() => setActiveTab('Crawl')} style={{ color: 'var(--nb-text-secondary)', background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>Re-crawl website</button>
                  <button onClick={() => setActiveTab('Theme')} style={{ background: '#36f4a4', color: '#000', border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Next: Detect Theme →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Theme' && (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 'min(100%, 300px)', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 3 — Detect & Set Theme</h2>
                <p style={{ fontSize: 14, color: 'var(--nb-text-secondary)' }}>Auto-detect your brand colors, then assign each color to chatbot components.</p>
              </div>
              <button onClick={extractTheme} style={{ background: 'transparent', border: '1px solid #36f4a4', color: '#36f4a4', borderRadius: 9999, padding: '12px 24px', fontSize: 14, cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                {extractingTheme ? (<><span style={{ width: 14, height: 14, border: '2px solid #36f4a4', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Detecting...</>) : '🎨 Detect Brand Colors'}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {THEME_COMPONENTS.map(({ key, label, desc }) => (
                  <div key={key} style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 10, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                      <div><div style={{ fontSize: 13, color: '#fff' }}>{label}</div><div style={{ fontSize: 11, color: 'var(--nb-text-secondary)' }}>{desc}</div></div>
                      <BasicColorPicker
                        value={themeConfig[key as keyof typeof themeConfig]}
                        onValueChange={(details) => setThemeConfig(prev => ({ ...prev, [key]: details.value.toString("hex") }))}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[...palette, ...PRESET_COLORS].filter((c, i, a) => a.indexOf(c) === i).map(color => (
                        <button key={color} type="button" className="nb-focus" onClick={() => setThemeConfig(prev => ({ ...prev, [key]: color }))} title={color}
                          aria-label={`Use ${color} for ${label}`}
                          aria-pressed={themeConfig[key as keyof typeof themeConfig] === color}
                          style={{ width: 28, height: 28, padding: 0, borderRadius: '50%', background: color, cursor: 'pointer', border: themeConfig[key as keyof typeof themeConfig] === color ? '2px solid #fff' : '2px solid transparent', transform: themeConfig[key as keyof typeof themeConfig] === color ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.15s' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('Preview')} style={{ background: '#36f4a4', color: '#000', border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Next: Preview →</button>
              </div>
            </div>
            <div style={{ flex: '0 1 260px', minWidth: 0, maxWidth: '100%' }}>
              <div style={{ fontSize: 12, color: 'var(--nb-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Preview</div>
              <div style={{ background: '#f7f8fc', borderRadius: 16, overflow: 'hidden', border: '1px solid #2a2d35' }}>
                <div style={{ background: themeConfig.headerColor, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                  <div><div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>AI Assistant</div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>● Online</div></div>
                </div>
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '8px 12px', fontSize: 12, color: '#333', maxWidth: '85%' }}>Hi! How can I help?</div>
                  <div style={{ background: themeConfig.userMsgColor, borderRadius: 12, padding: '8px 12px', fontSize: 12, color: '#000', maxWidth: '85%', alignSelf: 'flex-end' }}>Tell me more!</div>
                </div>
                <div style={{ borderTop: '1px solid #eee', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', background: '#fff' }}>
                  <div style={{ flex: 1, fontSize: 11, color: '#bbb', fontStyle: 'italic' }}>Ask a question...</div>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: themeConfig.sendBtnColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>➤</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 4 — Preview Your Chatbot</h2>
              <p style={{ fontSize: 14, color: 'var(--nb-text-secondary)' }}>Interact with your agent live using the custom colors you selected.</p>
            </div>
            {!crawlDone && <div style={{ background: '#1f2228', border: '1px solid #eab308', borderRadius: 8, padding: 16, color: '#eab308', fontSize: 14 }}>⚠ Complete Step 1 (Crawl) first.</div>}
            <div style={{ maxWidth: 560, background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: themeConfig.headerColor, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
                <div>
                  <div style={{ fontSize: 14, color: '#fff' }}>AI Assistant</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: previewLoading ? '#eab308' : '#36f4a4' }} />
                    {previewLoading ? 'Typing...' : 'Online'}
                  </div>
                </div>
              </div>
              <div className="nb-motion" role="log" aria-live="polite" aria-relevant="additions" aria-busy={previewLoading || previewIsTyping} aria-label="Chatbot preview conversation" style={{ height: 360, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {previewMessages.length === 0 && !previewLoading && !previewIsTyping ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nb-text-tertiary)', fontSize: 13 }}>Send a message to test your chatbot...</div>
                ) : (
                  <>
                    {previewMessages.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? themeConfig.userMsgColor : '#1f2228', color: msg.role === 'user' ? '#000' : '#fff', fontSize: 13, lineHeight: 1.55, border: msg.role === 'assistant' ? '1px solid #2a2d35' : 'none' }}>{msg.role === 'assistant' ? <ChatText text={msg.content} /> : msg.content}</div>
                      </div>
                    ))}
                    {previewLoading && !previewIsTyping && (
                      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#1f2228', border: '1px solid #2a2d35', display: 'flex', gap: 4 }}>
                          {[0, 1, 2].map(j => (<span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7d8187', display: 'inline-block', animation: `typingPulse 1.2s infinite ${j * 0.2}s` }} />))}
                        </div>
                      </div>
                    )}
                    {previewIsTyping && (
                      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: '#1f2228', color: '#fff', fontSize: 13, lineHeight: 1.55, border: '1px solid #2a2d35' }}>
                          <ChatText text={previewTypingText} caret={<span style={{ display: 'inline-block', width: 2, height: '1em', background: themeConfig.sendBtnColor, marginLeft: 3, verticalAlign: 'text-bottom', animation: 'cursorBlink 0.7s infinite' }} />} />
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={previewBottomRef} />
              </div>
              <div style={{ borderTop: '1px solid #2a2d35', padding: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <input aria-label="Message your chatbot" className="nb-focus" value={previewInput} onChange={e => setPreviewInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendPreviewMessage()} placeholder="Ask a question..." disabled={previewLoading || !crawlDone} style={{ flex: 1, background: '#1f2228', border: '1px solid #2a2d35', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none' }} />
                <button onClick={() => sendPreviewMessage()} disabled={previewLoading || !previewInput.trim() || !crawlDone} style={{ background: themeConfig?.sendBtnColor || '#6366f1', color: '#000', border: 'none', borderRadius: 9999, padding: '10px 18px', fontWeight: 500, fontSize: 13, cursor: 'pointer', opacity: previewLoading ? 0.5 : 1 }}>Send</button>
              </div>
            </div>
            {previewMessages.filter(m => m.role === 'assistant' && m.content).length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setActiveTab('Embed Code')} style={{ background: '#36f4a4', color: '#000', border: 'none', borderRadius: 9999, padding: '12px 28px', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Next: Get Embed Code →</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Embed Code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
            <div className="flex justify-between items-center">
              <div>
                <h2 style={{ fontSize: 20, color: '#fff', fontWeight: 400, marginBottom: 6 }}>Step 5 — Embed Your Chatbot</h2>
                <p style={{ fontSize: 14, color: 'var(--nb-text-secondary)' }}>Paste this script tag before &lt;/body&gt; on any website.</p>
              </div>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-transparent border-[#2a2d35] text-[color:var(--nb-text-secondary)] hover:text-white hover:border-[#36f4a4] rounded-full px-6 cursor-pointer">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share Snippet
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 bg-[#0a0a0a] border-[#2a2d35] text-white">
                  <PopoverHeader>
                    <PopoverTitle>Share this snippet</PopoverTitle>
                    <PopoverDescription className="text-[color:var(--nb-text-secondary)]">
                      Distribute your chatbot integration code.
                    </PopoverDescription>
                  </PopoverHeader>
                  <PopoverBody className="space-y-1 px-2 py-2">
                    {shareOptions.map((option) => (
                      <Button
                        key={option.name}
                        variant="ghost"
                        className="w-full justify-start text-[color:var(--nb-text-secondary)] hover:text-white hover:bg-[#1f2228] cursor-pointer"
                        size="sm"
                        onClick={option.action}
                      >
                        <option.icon className="mr-2 h-4 w-4" />
                        {option.name}
                        {option.name === 'Copy Link' && copiedShareUrl && <Check className="ml-auto h-3 w-3 text-[#36f4a4]" />}
                      </Button>
                    ))}
                  </PopoverBody>
                  <PopoverFooter className="py-4">
                    <Label htmlFor="share-url" className="text-xs text-[color:var(--nb-text-secondary)] mb-2 block">Direct Script URL</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="share-url"
                        value={scriptUrl}
                        readOnly
                        className="text-[10px] h-8 bg-[#1f2228] border-[#2a2d35] text-[#36f4a4]"
                      />
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 cursor-pointer" onClick={() => {
                        navigator.clipboard.writeText(scriptUrl);
                        markStepDone('embed');
                        setCopiedShareUrl(true);
                        setTimeout(() => setCopiedShareUrl(false), 2000);
                      }}>
                        {copiedShareUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </PopoverFooter>
                </PopoverContent>
              </Popover>
            </div>

            {!crawlDone && <div style={{ background: '#1f2228', border: '1px solid #eab308', borderRadius: 8, padding: 16, color: '#eab308', fontSize: 14 }}>⚠ Complete Steps 1–3 before embedding.</div>}
            
            <div style={{ background: '#0a0a0a', border: '1px solid #2a2d35', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #2a2d35', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--nb-text-secondary)', fontFamily: 'monospace' }}>HTML — paste before &lt;/body&gt;</span>
                <button onClick={() => { navigator.clipboard.writeText(embedCode); markStepDone('embed'); setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ background: copied ? '#0d2420' : 'transparent', border: '1px solid #2a2d35', color: copied ? '#36f4a4' : 'var(--nb-text-secondary)', borderRadius: 9999, padding: '4px 14px', fontSize: 12, cursor: 'pointer' }}>{copied ? '✓ Copied!' : 'Copy'}</button>
              </div>
              <pre style={{ padding: 20, margin: 0, fontSize: 13, fontFamily: 'monospace', color: '#36f4a4', overflowX: 'auto', lineHeight: 1.8 }}>{embedCode}</pre>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['Copy the script tag above', 'Paste it before </body> in your website HTML', 'Save and reload — your chatbot is live instantly', 'Works on: Next.js, React, WordPress, Webflow, plain HTML'].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: '#36f4a420', color: '#36f4a4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500 }}>{i + 1}</div>
                  <span style={{ fontSize: 14, color: 'var(--nb-text-secondary)' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
