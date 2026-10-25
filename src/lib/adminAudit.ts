import { getDb } from '@/lib/db';

export type AdminAuditEntry = {
  adminId: string;
  adminEmail?: string;
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
};

/** Never put secrets in `meta`; the log is readable from the admin panel. */
export async function logAdminAction(
  admin: { id: string; email?: string },
  action: string,
  target?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getDb();
    await db.collection<AdminAuditEntry>('admin_audit_log').insertOne({
      adminId: admin.id,
      adminEmail: admin.email,
      action,
      target,
      meta,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[admin_audit] failed to record action', action, error);
  }
}
