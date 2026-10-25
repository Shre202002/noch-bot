import Link from 'next/link';
import SignupModal from '@/components/ui/signup-modal';

const PRIMARY =
  'inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-medium text-[#080b10] transition-opacity hover:opacity-90';
const SECONDARY =
  'inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white';

/** Call-to-action block placed inside articles, comparisons and tools. */
export function InlineCta({
  title = 'Try NochBot on your own content',
  body = 'Start on the free plan. Upgrade only when you need higher limits.',
  secondary = { href: '/#pricing', label: 'See plans' },
}: {
  title?: string;
  body?: string;
  secondary?: { href: string; label: string };
}) {
  return (
    <aside className="my-10 rounded-2xl border border-[#36f4a4]/20 bg-[#36f4a4]/[0.04] p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-white/60">{body}</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <SignupModal trigger={<button className={PRIMARY}>Start free</button>} />
        <Link href={secondary.href} className={SECONDARY}>
          {secondary.label}
        </Link>
      </div>
    </aside>
  );
}
