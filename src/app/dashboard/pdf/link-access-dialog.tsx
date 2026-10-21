'use client';
// Owner view of a sign-in protected share link: approve or decline sign-ups, block/unblock, sign a device out.

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type LinkUserRow = {
  id: string;
  loginId: string;
  status: 'pending' | 'approved' | 'rejected' | 'blocked';
  createdAt: string;
  lastLoginAt: string | null;
  blockedAt: string | null;
  signedIn: boolean;
};

type Action = 'approve' | 'reject' | 'block' | 'unblock' | 'signout' | 'remove';

const STATUS_LABEL: Record<LinkUserRow['status'], string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Declined',
  blocked: 'Blocked',
};

const STATUS_COLOR: Record<LinkUserRow['status'], string> = {
  pending: '#eab308',
  approved: '#36f4a4',
  rejected: 'var(--nb-text-tertiary)',
  blocked: '#ef4444',
};

const ACTIONS_FOR: Record<LinkUserRow['status'], { action: Action; label: string; primary?: boolean }[]> = {
  pending: [{ action: 'approve', label: 'Approve', primary: true }, { action: 'reject', label: 'Decline' }],
  approved: [{ action: 'signout', label: 'Sign out device' }, { action: 'block', label: 'Block' }],
  blocked: [{ action: 'unblock', label: 'Unblock', primary: true }, { action: 'remove', label: 'Remove' }],
  rejected: [{ action: 'approve', label: 'Approve' }, { action: 'remove', label: 'Remove' }],
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never';

type Props = {
  slug: string | null;
  label: string;
  onClose: () => void;
  /** Called with the new pending count after the list loads or changes. */
  onPendingChange: (slug: string, pending: number) => void;
};

export function LinkAccessDialog({ slug, label, onClose, onPendingChange }: Props) {
  const [users, setUsers] = useState<LinkUserRow[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setError('');
    try {
      const res = await fetch(`/api/pdf-links/${encodeURIComponent(slug)}/users`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not load users.');
        return;
      }
      setUsers(data.users);
      onPendingChange(slug, data.pendingCount ?? 0);
    } catch {
      setError('Could not load users. Check your connection.');
    }
  }, [slug, onPendingChange]);

  useEffect(() => {
    setUsers(null);
    load();
  }, [load]);

  const act = async (user: LinkUserRow, action: Action) => {
    if (!slug) return;
    if (action === 'remove' && !window.confirm(`Remove "${user.loginId}"? They can sign up again and will need approval.`)) return;
    setBusyId(user.id);
    setError('');
    try {
      const res = await fetch(`/api/pdf-links/${encodeURIComponent(slug)}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Could not update this user.');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={slug !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg border-[#2a2d35] bg-[#1f2228] text-white">
        <DialogHeader>
          <DialogTitle>Manage access</DialogTitle>
          <DialogDescription style={{ color: 'var(--nb-text-secondary)' }}>
            People who signed up for the share link of “{label}”. Only approved accounts can chat, one device at a time.
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}

        {users === null ? (
          <p role="status" style={{ fontSize: 13, color: 'var(--nb-text-secondary)', margin: 0 }}>Loading…</p>
        ) : users.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--nb-text-secondary)', margin: 0, lineHeight: 1.6 }}>
            No sign-ups yet. Share the link; people create an account on it and appear here for approval.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
            {users.map(user => (
              <li key={user.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#0a0a0a', border: '1px solid #2a2d35' }}>
                <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                  <div style={{ fontSize: 14, color: '#fff', overflowWrap: 'anywhere' }}>{user.loginId}</div>
                  <div style={{ fontSize: 12, color: 'var(--nb-text-tertiary)', marginTop: 2, display: 'flex', flexWrap: 'wrap', columnGap: 8 }}>
                    <span style={{ color: STATUS_COLOR[user.status] }}>{STATUS_LABEL[user.status]}</span>
                    <span>Last sign-in {formatDate(user.lastLoginAt)}</span>
                    {user.status === 'approved' && user.signedIn && <span>Signed in on a device</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {ACTIONS_FOR[user.status]
                    .filter(a => a.action !== 'signout' || user.signedIn)
                    .map(a => (
                      <button key={a.action} type="button" className="nb-focus" disabled={busyId === user.id}
                        onClick={() => act(user, a.action)}
                        aria-label={`${a.label} ${user.loginId}`}
                        style={{ minHeight: 36, padding: '0 12px', borderRadius: 9999, fontSize: 12, cursor: busyId === user.id ? 'wait' : 'pointer',
                          background: a.primary ? '#36f4a4' : 'transparent', color: a.primary ? '#000' : 'var(--nb-text-secondary)',
                          border: a.primary ? 'none' : '1px solid #3a3d45', opacity: busyId === user.id ? 0.6 : 1 }}>
                        {a.label}
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
