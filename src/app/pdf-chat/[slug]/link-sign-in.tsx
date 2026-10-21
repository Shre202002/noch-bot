'use client';
// Sign-in gate for sign-in protected PDF chat links. Link accounts belong to this one link and need the
// link owner's approval; the server enforces single-device sessions and blocks repeated sign-ins.

import { useState } from 'react';
import { FileText, Lock, Clock, ShieldX } from 'lucide-react';

export type GateMode = 'signin' | 'register' | 'pending' | 'rejected' | 'blocked';

type Props = {
  slug: string;
  label: string;
  initialMode?: GateMode;
  /** Shown above the form, e.g. "signed out because this account signed in on another device". */
  notice?: string | null;
  onSignedIn: () => void;
};

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, minHeight: 44,
  border: '1px solid var(--bg-300)', background: 'var(--bg-0)', color: 'var(--text-100)', fontSize: 15,
  fontFamily: 'inherit',
};

export function LinkSignIn({ slug, label, initialMode = 'signin', notice, onSignedIn }: Props) {
  const [mode, setMode] = useState<GateMode>(initialMode);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState(notice || '');
  const [busy, setBusy] = useState(false);

  const base = `/api/pdf-links/${encodeURIComponent(slug)}/auth`;

  const switchMode = (next: GateMode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirm('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${base}/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && mode === 'register') {
        setStatusText(data.message || '');
        switchMode('pending');
        return;
      }
      if (res.ok) {
        onSignedIn();
        return;
      }
      if (data.code === 'pending' || data.code === 'rejected' || data.code === 'blocked') {
        setStatusText(data.error || '');
        switchMode(data.code);
        return;
      }
      setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const Panel = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
      <div aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(217,119,87,0.1)', border: '1px solid rgba(217,119,87,0.2)' }}>{icon}</div>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-100)', margin: 0 }}>{title}</h1>
      {children}
    </div>
  );

  const isForm = mode === 'signin' || mode === 'register';

  return (
    <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg-100)', border: '1px solid var(--bg-300)', borderRadius: 18, padding: 'clamp(20px, 5vw, 28px)', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, color: 'var(--text-400)', fontSize: 12, minWidth: 0 }}>
          <FileText aria-hidden="true" size={14} color="#D97757" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </div>

        {isForm && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-100)', margin: '0 0 4px' }}>
              {mode === 'signin' ? 'Sign in to this document' : 'Create an account'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-400)', margin: '0 0 18px', lineHeight: 1.5 }}>
              {mode === 'signin'
                ? 'Access is limited to people approved by the owner of this link.'
                : 'This account works only for this link. The owner approves it before you can chat.'}
            </p>

            {statusText && (
              <p role="status" style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 14px', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-200)', color: 'var(--text-200)' }}>
                {statusText}
              </p>
            )}

            <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-300)' }}>
                Login ID
                <input className="pc-focus" style={fieldStyle} value={loginId} onChange={e => setLoginId(e.target.value)}
                  autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32}
                  aria-describedby={mode === 'register' ? 'login-id-hint' : undefined} />
              </label>
              {mode === 'register' && (
                <span id="login-id-hint" style={{ fontSize: 12, color: 'var(--text-400)', marginTop: -6 }}>
                  3–32 characters: letters, numbers, dots, dashes or underscores.
                </span>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-300)' }}>
                Password
                <input className="pc-focus" style={fieldStyle} type="password" value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={8} />
              </label>
              {mode === 'register' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-300)' }}>
                  Confirm password
                  <input className="pc-focus" style={fieldStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password" required minLength={8} />
                </label>
              )}

              {error && <p role="alert" style={{ fontSize: 13, color: '#dc2626', margin: 0, lineHeight: 1.5 }}>{error}</p>}

              <button type="submit" className="pc-focus" disabled={busy || !loginId.trim() || !password}
                style={{ minHeight: 44, borderRadius: 10, border: 'none', background: '#D97757', color: '#fff', fontSize: 15, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy || !loginId.trim() || !password ? 0.6 : 1, marginTop: 4 }}>
                {busy ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : (mode === 'signin' ? 'Sign in' : 'Create account')}
              </button>
            </form>

            {mode === 'signin' && (
              <p style={{ fontSize: 12, color: 'var(--text-400)', margin: '14px 0 0', lineHeight: 1.5 }}>
                Signing in on a new device signs out the previous one. Repeated sign-ins within two days lock the account until the owner unlocks it.
              </p>
            )}

            <div style={{ borderTop: '1px solid var(--bg-300)', marginTop: 18, paddingTop: 14, fontSize: 13, color: 'var(--text-400)', textAlign: 'center' }}>
              {mode === 'signin' ? 'No account yet? ' : 'Already have an account? '}
              <button type="button" className="pc-focus" onClick={() => { setStatusText(''); switchMode(mode === 'signin' ? 'register' : 'signin'); }}
                style={{ background: 'none', border: 'none', padding: '4px 2px', color: '#D97757', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </div>
          </>
        )}

        {mode === 'pending' && (
          <Panel icon={<Clock size={24} color="#D97757" />} title="Waiting for approval">
            <p role="status" style={{ fontSize: 14, color: 'var(--text-300)', margin: 0, lineHeight: 1.6 }}>
              {statusText || "Your account is waiting for the link owner's approval."} Sign in again once they have approved it.
            </p>
            <button type="button" className="pc-focus" onClick={() => switchMode('signin')}
              style={{ minHeight: 44, padding: '0 18px', borderRadius: 10, border: '1px solid var(--bg-300)', background: 'var(--bg-200)', color: 'var(--text-100)', fontSize: 14, cursor: 'pointer' }}>
              Back to sign in
            </button>
          </Panel>
        )}

        {(mode === 'rejected' || mode === 'blocked') && (
          <Panel icon={mode === 'blocked' ? <Lock size={24} color="#D97757" /> : <ShieldX size={24} color="#D97757" />}
            title={mode === 'blocked' ? 'Account locked' : 'Access declined'}>
            <p role="alert" style={{ fontSize: 14, color: 'var(--text-300)', margin: 0, lineHeight: 1.6 }}>{statusText}</p>
          </Panel>
        )}
      </div>
    </main>
  );
}
