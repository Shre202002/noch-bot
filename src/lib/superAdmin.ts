import { findAccountById, updateAccount, type Account } from '@/lib/storage';
import { getDb } from '@/lib/db';

export function isBootstrapAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** Promotes accounts listed in SUPER_ADMIN_EMAILS. Call after a successful sign-in. */
export async function ensureBootstrapAdmin(account: Account): Promise<Account> {
  if (account.role === 'superadmin' || !isBootstrapAdmin(account.email)) return account;
  await updateAccount(account.id, { role: 'superadmin' });
  return { ...account, role: 'superadmin' };
}

export async function countActiveSuperAdmins(): Promise<number> {
  const db = await getDb();
  return db.collection('accounts').countDocuments({ role: 'superadmin', disabled: { $ne: true } });
}

/**
 * Blocks changes that would leave the platform with no usable admin, or let an admin lock
 * themselves out. Returns an error message, or null when the change is allowed.
 */
export async function guardAdminChange(
  actingAdminId: string,
  targetId: string,
  change: 'disable' | 'demote' | 'delete',
): Promise<string | null> {
  const target = await findAccountById(targetId);
  if (!target || target.role !== 'superadmin') return null;
  if (actingAdminId === targetId) return `You cannot ${change} your own admin account`;
  if ((await countActiveSuperAdmins()) <= 1) return 'At least one active super admin is required';
  return null;
}
