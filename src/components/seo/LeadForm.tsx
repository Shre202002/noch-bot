'use client';

import { useState } from 'react';

type Props = { source: string; heading?: string; blurb?: string; button?: string };

/** Email capture for content pages; posts to /api/leads and says plainly whether it worked. */
export function LeadForm({ source, heading = 'Get new guides by email', blurb, button = 'Subscribe' }: Props) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const website = String(new FormData(e.currentTarget).get('website') ?? '');
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setState('idle');
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-semibold">{heading}</h2>
      {blurb && <p className="mt-1 text-sm text-white/55">{blurb}</p>}
      {state === 'done' ? (
        <p role="status" className="mt-4 text-sm text-[#36f4a4]">
          Thanks, you are on the list.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row" noValidate>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          <label htmlFor={`lead-${source}`} className="sr-only">
            Email address
          </label>
          <input
            id={`lead-${source}`}
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            placeholder="you@company.com"
            aria-invalid={!!error}
            className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:border-[#36f4a4]/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === 'sending'}
            className="h-11 rounded-full bg-white px-6 text-sm font-medium text-[#080b10] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {state === 'sending' ? 'Sending…' : button}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
