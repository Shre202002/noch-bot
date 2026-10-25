# Super Admin Dashboard

Platform-operator area at `/admin`, separate from the organizer dashboard. Server-side gate on every route (`requireSuperAdmin()`); UI hiding is not access control.

## Phase A - Foundation (done)
- Roles, `SUPER_ADMIN_EMAILS` bootstrap, self-lockout / last-admin guards.
- Deactivation enforced at email login, Google login and on live sessions.
- Plans in the database with expiry and enforcement in chat, crawl, analytics and PDF routes.
- Users page (search, filter, detail, plan change, deactivate) and Plans page (CRUD).
- Audit writer (`admin_audit_log`).

## Phase B - Gap closure (done)
- Audit log API + `/admin/audit` page with action filter and paging.
- Overview: 30-day sign-ups, plans expiring in 7 days, recent sign-ups, recent admin activity.
- Tests: bootstrap, guards, `requireSuperAdmin` 401/403/disabled, audit writer (`src/lib/superAdmin.test.ts`).
- `SUPER_ADMIN_EMAILS` and admin model documented in AGENTS.md.

## Phase C - Operations (done)
- Per-user detail: 6-month message history, booking counts by status.
- Bulk actions (plan, deactivate, reactivate) for up to 100 users: per-account results, self-lockout / last-admin guards still apply, one audit entry per batch listing the ids.
- Role management: super admin filter on the users list; promote/demote in the user dialog (guarded).
- Re-queue embeddings: marks a user's spreadsheet rows without an embedding as pending; the owner's dashboard index loop does the embedding. Failed PDFs cannot be re-indexed server-side because the source file is not stored, so they are listed in Health for the owner to retry.

## Phase D - Platform health (done)
- `/admin/health`: MongoDB ping, crawler `/healthz` (never exposes URL or token), the three Atlas vector indexes, failed/stale document list, rows awaiting embedding, `needs_refund` queue, late payments stuck over 1 hour.
- `/admin/analytics`: sign-ups and messages per day (7/30/90 days), estimated subscription revenue (active, non-admin-granted subscribers x list price), paid ticket sales by currency.

## Phase E - Genuine users and visibility (done)
- Email verification: email/password signups need an OTP before crawl, document upload, share links, bot theme and website chat; Google verified; older accounts grandfathered; admin filter, badge and "Mark verified".
- Admin chat history per user (website bot and PDF/sheet links), thread views audited, visitor IP hidden.
- Health: failed documents and the refund queue show the owner's name/email, file type, and an "Open user" deep link.
- Plans page redesigned: plan cards, inline Active switch, edit dialog with customer preview.

## Acceptance (Phases A-D)
- Sign in as a listed email, open `/admin`; a normal user is redirected to `/dashboard`.
- Deactivate a user: login fails and their open session stops working.
- Change a plan's limits: enforcement reflects it.
- Every admin write appears in `/admin/audit`.
- Bulk-deactivate including yourself: your row is refused, others succeed.
- Health shows the crawler down when `CRAWLER_SERVICE_URL` is unreachable.
- A booking in `needs_refund` appears in the refund queue.
- Register a new Gmail account by email: crawl is refused until the OTP is entered; Google and older accounts are unaffected.
- Open a user with chats: both tabs list and open threads, and `user.chats.view` appears in the audit log.
