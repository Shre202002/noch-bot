---
last_mapped_commit: e566539034890af2cc1da4196897f16e95975860
last_mapped_at: 2026-09-30
---
# External Integrations

**Analysis Date:** 2026-09-30

## APIs & External Services

**AI / LLM Providers:**
- Google Gemini via Genkit - Structured AI flows for response generation, knowledge-base creation, and persona customization.
  - SDK/Client: `genkit`, `@genkit-ai/google-genai`
  - Auth: `GOOGLE_GENAI_API_KEY`
  - Implementation: `src/ai/genkit.ts`, `src/ai/flows/ai-response-generation.ts`, `src/ai/flows/bot-knowledge-base-creation-flow.ts`, `src/ai/flows/bot-persona-customization.ts`
- Google Gemini Embeddings REST API - Embeds knowledge and PDF chunks for MongoDB vector search.
  - SDK/Client: native `fetch`
  - Auth: `GEMINI_API_KEY`
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`
  - Implementation: `src/lib/embeddings.ts`, `src/lib/vectorStore.ts`
- Groq Chat Completions - Chat and PDF-chat completions.
  - SDK/Client: `groq-sdk` in `src/app/api/chat/route.ts`; native `fetch` to OpenAI-compatible endpoint in `src/app/api/chat/pdf/route.ts`
  - Auth: `GROQ_API_KEY`
  - Endpoint: `https://api.groq.com/openai/v1/chat/completions`

**Payments:**
- Stripe - Checkout Session creation and webhook signature verification.
  - SDK/Client: `stripe`
  - Auth: tenant-provided `secret_key` encrypted in MongoDB; webhook secret encrypted in MongoDB
  - Implementation: `src/lib/payments/stripe.ts`, `src/app/api/events/[id]/payment-gateway/route.ts`, `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`
- Razorpay - Order creation, credential verification, hosted checkout bridge, and webhook HMAC verification.
  - SDK/Client: native `fetch`
  - Auth: tenant-provided `key_id` and `key_secret` encrypted in MongoDB; webhook secret encrypted in MongoDB
  - Endpoint: `https://api.razorpay.com/v1/orders`, `https://api.razorpay.com/v1/payments?count=1`
  - Implementation: `src/lib/payments/razorpay.ts`, `src/app/api/events/[id]/payment-gateway/route.ts`, `src/app/booking/pay/[bookingId]/page.tsx`
- PayPal - OAuth client credentials, order creation, and webhook verification.
  - SDK/Client: native `fetch`
  - Auth: tenant-provided `client_id` and `client_secret` encrypted in MongoDB; webhook ID/secret value supplied through payment config
  - Endpoint: `https://api-m.paypal.com` or `https://api-m.sandbox.paypal.com`
  - Mode env: `PAYPAL_MODE`
  - Implementation: `src/lib/payments/paypal.ts`
- Cashfree - Order creation and webhook signature verification.
  - SDK/Client: native `fetch`
  - Auth: tenant-provided `app_id` and `secret_key` encrypted in MongoDB; webhook secret encrypted in MongoDB
  - Endpoint: `https://api.cashfree.com/pg` or `https://sandbox.cashfree.com/pg`
  - Mode env: `CASHFREE_MODE`
  - Implementation: `src/lib/payments/cashfree.ts`

**Authentication / Identity APIs:**
- Google OAuth 2.0 - Login/signup with Google profile data.
  - SDK/Client: native `fetch` and Next redirects
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Endpoints: `https://accounts.google.com/o/oauth2/v2/auth`, `https://oauth2.googleapis.com/token`, `https://www.googleapis.com/oauth2/v2/userinfo`
  - Implementation: `src/app/api/auth/google/route.ts`, `src/app/api/auth/google/callback/route.ts`

**Email:**
- Gmail SMTP - OTP and contact emails.
  - SDK/Client: `nodemailer`
  - Auth: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
  - Implementation: `src/lib/mailer.ts`, auth/contact API routes under `src/app/api/auth/` and `src/app/api/contact/route.ts`

**File Upload / Images:**
- ImageKit - Signed client-side uploads and image transformations.
  - SDK/Client: HMAC auth routes plus browser upload to ImageKit REST API
  - Auth: `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`
  - Endpoint: `https://upload.imagekit.io/api/v1/files/upload`
  - Implementation: `src/app/api/imagekit/auth/route.ts`, `src/app/api/imagekit/upload-auth/route.ts`, `src/app/api/images/auth/route.ts`, `src/app/dashboard/events/[id]/page.tsx`
- Remote image allowlist - Next image optimization permits `placehold.co`, `images.unsplash.com`, and `picsum.photos`.
  - SDK/Client: Next Image configuration
  - Auth: None
  - Implementation: `next.config.ts`

**Repository / Public Data:**
- GitHub REST API - Fetches recent commits for `Shre202002/noch-bot`.
  - SDK/Client: native `fetch`
  - Auth: optional `GITHUB_TOKEN`
  - Endpoint: `https://api.github.com/repos/Shre202002/noch-bot/commits?per_page=10`
  - Implementation: `src/app/api/github-commits/route.ts`
- External website crawling - Crawls user-supplied pages for knowledge extraction and theme extraction.
  - SDK/Client: `axios`, `cheerio`
  - Auth: None detected
  - Implementation: `src/ai/flows/bot-knowledge-base-creation-flow.ts`, `src/app/api/crawl/route.ts`, `src/app/api/extract-theme/route.ts`

**Observability / Product Analytics:**
- Vercel Analytics - Client-side analytics mounted globally.
  - SDK/Client: `@vercel/analytics/next`
  - Auth: Vercel project configuration
  - Implementation: `src/app/layout.tsx`
- Vercel Speed Insights - Web performance telemetry mounted globally.
  - SDK/Client: `@vercel/speed-insights/next`
  - Auth: Vercel project configuration
  - Implementation: `src/app/layout.tsx`
- Internal behavioral analytics - Browser SDK sends events to the app backend.
  - SDK/Client: custom client in `src/lib/analytics.ts`
  - Auth: app cookie/session context
  - Endpoint: `/api/analytics/track`
  - Implementation: `src/lib/storage.ts`, `src/app/api/analytics/track/route.ts`, `src/app/api/analytics/route.ts`

## Data Storage

**Databases:**
- MongoDB / MongoDB Atlas
  - Connection: `MONGODB_URI`, `MONGODB_DB`
  - Client: `mongodb` native driver
  - Implementation: `src/lib/db.ts`
  - Collections used by code include account/storage collections in `src/lib/storage.ts`, conversations in `src/lib/conversations.ts`, bookings/events/tickets in `src/lib/bookingDb.ts` and `src/models/*.ts`, `payment_gateway_configs`, `processed_webhooks`, `payment_webhook_events`, `analytics_events`, `nochbot_chunks`, and `nochbot_pdf_chunks`.
- MongoDB Atlas Vector Search
  - Connection: same MongoDB connection
  - Client: `mongodb` native driver aggregation with `$vectorSearch`
  - Implementation: `src/lib/vectorStore.ts`
  - Indexes: `nochbot_chunks_vector_index`, `nochbot_pdf_chunks_vector_index`

**File Storage:**
- ImageKit for event logo uploads and transformations through `src/app/dashboard/events/[id]/page.tsx`.
- MongoDB stores PDF/knowledge metadata and vector chunks through `src/lib/vectorStore.ts` and related PDF API routes.
- Local filesystem storage is not the primary persistent storage pattern in the explored source.

**Caching:**
- Next.js fetch cache for GitHub commits with `next: { revalidate: 3600 }` in `src/app/api/github-commits/route.ts`.
- MongoDB client caching in development/test via `global._mongoClient` in `src/lib/db.ts`.
- No Redis or external cache service detected.

## Authentication & Identity

**Auth Provider:**
- Custom email/password auth with optional Google OAuth.
  - Implementation: JWT cookie auth in `src/lib/auth.ts`; password/OTP hashing with `bcryptjs` in `src/app/api/auth/*.ts`; account storage through `src/lib/storage.ts`.
  - Cookie: `token`, HTTP-only, seven-day max age, set by `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`, and `src/app/api/auth/google/callback/route.ts`.
  - JWT secret: `JWT_SECRET`.
- Google OAuth
  - Implementation: `src/app/api/auth/google/route.ts`, `src/app/api/auth/google/callback/route.ts`.
  - Required env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`.

## Monitoring & Observability

**Error Tracking:**
- Dedicated external error tracking service: None detected.
- Errors are logged with `console.error` in API routes and service modules such as `src/lib/mailer.ts`, `src/app/api/analytics/route.ts`, `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`, and `src/app/api/github-commits/route.ts`.

**Logs:**
- Server logs use `console.log`, `console.warn`, and `console.error`.
- Payment webhook processing writes idempotency records and raw payloads to MongoDB collections through `src/app/api/payments/webhook/[provider]/[orgId]/route.ts` and `src/lib/payments/processWebhookResult.ts`.
- Internal analytics events are persisted through `src/lib/storage.ts`.

## CI/CD & Deployment

**Hosting:**
- Vercel is indicated by `README.md` badges and by `@vercel/analytics` / `@vercel/speed-insights` in `src/app/layout.tsx`.
- Firebase App Hosting configuration exists in `apphosting.yaml` with `runConfig.maxInstances: 1`.

**CI Pipeline:**
- None detected in the explored root. No GitHub Actions workflow was identified during stack mapping.

## Environment Configuration

**Required env vars:**
- `MONGODB_URI` - Required by `src/lib/db.ts`.
- `MONGODB_DB` - Used by `src/lib/db.ts` to select the database.
- `JWT_SECRET` - Used by `src/lib/auth.ts`; code has a development fallback, but production should provide it.
- `NEXTAUTH_URL` - Required for OAuth redirects and payment success/cancel URLs in `src/app/api/auth/google/*.ts`, `src/lib/payments/razorpay.ts`, `src/lib/payments/cashfree.ts`, and booking confirmation routes.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Required for Google OAuth in `src/app/api/auth/google/*.ts`.
- `GOOGLE_GENAI_API_KEY` - Required by Genkit Google AI plugin in `src/ai/genkit.ts`.
- `GEMINI_API_KEY` - Required by direct embedding calls in `src/lib/embeddings.ts`.
- `GROQ_API_KEY` - Required by chat APIs in `src/app/api/chat/route.ts` and `src/app/api/chat/pdf/route.ts`.
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` - Required by `src/lib/mailer.ts`.
- `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` - Required by ImageKit auth/upload flows in `src/app/api/imagekit/*.ts` and `src/app/api/images/auth/route.ts`.
- `CREDENTIAL_ENCRYPTION_KEY` - Required by `src/lib/credentialCrypto.ts` to encrypt/decrypt payment gateway credentials.
- `TICKET_QR_SECRET` - Required by ticket issuing/scanning code in `src/lib/ticketIssuance.ts`, `src/app/api/scanner/sync/route.ts`, and `src/app/api/scanner/tickets/[ticketCode]/scan/route.ts`.
- `PAYPAL_MODE` - Selects PayPal live vs sandbox endpoint in `src/lib/payments/paypal.ts`.
- `CASHFREE_MODE` - Selects Cashfree production vs sandbox endpoint in `src/lib/payments/cashfree.ts`.
- `GITHUB_TOKEN` - Optional GitHub API token in `src/app/api/github-commits/route.ts`.

**Secrets location:**
- `.env` file present - contains environment configuration and was not read.
- `env.txt` file present - not read because it may contain secret-like values.
- Production secrets should be stored in the deployment provider secret manager for Vercel or Firebase App Hosting.
- Tenant payment credentials and webhook secrets are encrypted with `CREDENTIAL_ENCRYPTION_KEY` and stored in MongoDB by `src/app/api/events/[id]/payment-gateway/route.ts`.

## Webhooks & Callbacks

**Incoming:**
- `/api/payments/webhook/[provider]/[orgId]` - Central payment webhook receiver for Stripe, Razorpay, PayPal, and Cashfree in `src/app/api/payments/webhook/[provider]/[orgId]/route.ts`.
- `/api/payments/webhook/stripe/[orgId]` - Stripe-specific payment webhook route in `src/app/api/payments/webhook/stripe/[orgId]/route.ts`.
- `/api/payments/webhook/razorpay/[orgId]` - Razorpay-specific payment webhook route in `src/app/api/payments/webhook/razorpay/[orgId]/route.ts`.
- `/api/auth/google/callback` - Google OAuth callback in `src/app/api/auth/google/callback/route.ts`.
- `/api/analytics/track` - Internal client analytics ingestion route in `src/app/api/analytics/track/route.ts`.
- `/api/contact` - Contact form email route in `src/app/api/contact/route.ts`.

**Outgoing:**
- Stripe Checkout creates hosted checkout sessions in `src/lib/payments/stripe.ts`.
- Razorpay creates orders through `https://api.razorpay.com/v1/orders` and loads checkout script from `https://checkout.razorpay.com/v1/checkout.js` in `src/app/booking/pay/[bookingId]/page.tsx`.
- PayPal creates checkout orders and verifies webhooks through PayPal API endpoints in `src/lib/payments/paypal.ts`.
- Cashfree creates orders and provides `notify_url` pointing back to `/api/payments/webhook/cashfree/[orgId]` in `src/lib/payments/cashfree.ts`.
- Google OAuth redirects to Google and exchanges authorization codes in `src/app/api/auth/google/*.ts`.
- Groq, Gemini, ImageKit, GitHub, and crawled websites are called from the files listed in the APIs section.

---

*Integration audit: 2026-09-30*
