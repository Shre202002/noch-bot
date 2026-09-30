---
last_mapped_commit: e566539034890af2cc1da4196897f16e95975860
last_mapped_at: 2026-09-30
---
# Technology Stack

**Analysis Date:** 2026-09-30

## Languages

**Primary:**
- TypeScript 5.x - Application code, Next.js routes, React components, AI flows, models, and tests in `src/`.
- TSX / React 19.2.x - App Router pages and UI components in `src/app/` and `src/components/`.

**Secondary:**
- JavaScript - Allowed by `tsconfig.json` via `allowJs`; no primary application JavaScript entry point detected.
- CSS - Global styling in `src/app/globals.css`, Tailwind theme tokens in `tailwind.config.ts`.
- YAML - Firebase App Hosting backend configuration in `apphosting.yaml`.

## Runtime

**Environment:**
- Node.js - Required for Next.js 15, server route handlers, Genkit, MongoDB driver, Stripe SDK, Nodemailer, and Vitest. No explicit Node version file or `package.json` `engines` field detected.
- Next.js runtime - API routes use App Router route handlers under `src/app/api/**/route.ts`.

**Package Manager:**
- npm - `package-lock.json` is present.
- Lockfile: present (`package-lock.json`).

## Frameworks

**Core:**
- Next.js `^15.5.24` - Full-stack React framework, App Router pages in `src/app/`, API routes in `src/app/api/`, image configuration in `next.config.ts`.
- React `^19.2.1` / React DOM `^19.2.1` - Client and server component UI layer in `src/app/` and `src/components/`.
- TypeScript `^5` - Static typing with strict mode in `tsconfig.json`.
- Tailwind CSS `^4.0.0` - Utility styling, theme extension, and content scanning configured in `tailwind.config.ts`; PostCSS integration via `postcss.config.mjs`.
- Genkit `^1.28.0` with `@genkit-ai/google-genai` `^1.28.0` - AI flow framework and Google Gemini provider in `src/ai/genkit.ts` and `src/ai/flows/*.ts`.

**Testing:**
- Vitest `^3.2.7` - Unit/integration runner configured in `vitest.config.ts`.
- mongodb-memory-server `^11.2.0` - In-memory MongoDB test backend in `src/test/mongo-setup.ts`.

**Build/Dev:**
- Next CLI - `npm run dev` starts `next dev --turbopack -p 9002`; `npm run build` runs `NODE_ENV=production next build`; `npm run start` runs `next start`.
- Turbopack - Used by the dev server script in `package.json`.
- Genkit CLI `^0.0.2` - `npm run genkit:dev` and `npm run genkit:watch` start flows from `src/ai/dev.ts`.
- TypeScript compiler - `npm run typecheck` runs `tsc --noEmit`.
- patch-package `^8.0.0` - Installed for dependency patching; no patch files detected in the explored root.

## Key Dependencies

**Critical:**
- `mongodb` `^6.3.0` - Primary database driver in `src/lib/db.ts`; used across models, booking, analytics, storage, vector search, and payments.
- `stripe` `^17.7.0` - Stripe Checkout and webhook verification in `src/lib/payments/stripe.ts`.
- `groq-sdk` `^1.1.2` - Groq chat completions in `src/app/api/chat/route.ts`; direct Groq REST calls in `src/app/api/chat/pdf/route.ts`.
- `genkit` `^1.28.0` and `@genkit-ai/google-genai` `^1.28.0` - Gemini-backed AI generation in `src/ai/genkit.ts` and `src/ai/flows/`.
- `jsonwebtoken` `^9.0.2` - Cookie token signing and verification in `src/lib/auth.ts`.
- `bcryptjs` `^2.4.3` - Password and OTP hashing in auth/account API routes under `src/app/api/auth/` and `src/app/api/account/`.
- `nodemailer` `^9.0.6` - Gmail SMTP email sending in `src/lib/mailer.ts`.
- `zod` `^3.24.2` - Validation/schema support for Genkit flows in `src/ai/flows/*.ts`.
- `unpdf` `^1.6.2` - PDF parsing dependency used by PDF chat/ingestion support; related local parser code is in `src/lib/pdfParser.ts`.

**Infrastructure:**
- `@vercel/analytics` `^1.6.1` and `@vercel/speed-insights` `^1.1.0` - Client telemetry mounted in `src/app/layout.tsx`.
- `firebase` `^11.9.1` - Firebase package installed; hosting backend settings live in `apphosting.yaml`. Direct Firebase client usage was not detected in `src/`.
- `axios` `^1.7.9` - HTTP crawling/theme extraction in `src/ai/flows/bot-knowledge-base-creation-flow.ts`, `src/app/api/crawl/route.ts`, and `src/app/api/extract-theme/route.ts`.
- `cheerio` `^1.0.0` - HTML parsing for crawling/knowledge extraction.
- `html2canvas` `^1.4.1` - Browser-side canvas capture support for UI/export flows.
- `papaparse` `^5.5.3` - CSV parsing dependency.
- `qrcode.react` `^4.2.0` - QR rendering for tickets/scanner flows.
- `date-fns` `^3.6.0` - Date formatting and manipulation.
- `uuid` `^9.0.1` - Account IDs and generated identifiers, including Google OAuth account creation in `src/app/api/auth/google/callback/route.ts`.
- `@radix-ui/react-*`, `@ark-ui/react`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate` - UI primitive, icon, variant, and utility stack used by `src/components/ui/`.
- `framer-motion` `^11.2.12`, `gsap` `^3.12.5`, `cobe` `^0.6.3`, `embla-carousel-react` `^8.6.0`, `recharts` `^2.15.1` - Motion, globe/visual, carousel, and charting libraries used by app UI and dashboards.
- `@dnd-kit/*` - Drag-and-drop/sortable interactions for configurable UI such as event form fields.

## Configuration

**Environment:**
- Environment variables are read directly through `process.env` in server code. Keep required runtime values in `.env`/deployment secrets, but never commit secret values.
- `.env` file present - contains environment configuration and was not read.
- `env.txt` file present - possible environment documentation/config file and was not read because it may contain secret-like values.
- Database variables: `MONGODB_URI`, `MONGODB_DB` in `src/lib/db.ts`.
- Auth/session variables: `JWT_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `src/lib/auth.ts` and `src/app/api/auth/google/*.ts`.
- AI variables: `GOOGLE_GENAI_API_KEY` for Genkit in `src/ai/genkit.ts`; `GEMINI_API_KEY` for direct embeddings in `src/lib/embeddings.ts`; `GROQ_API_KEY` in `src/app/api/chat/route.ts` and `src/app/api/chat/pdf/route.ts`.
- Email variables: `GMAIL_USER`, `GMAIL_APP_PASSWORD` in `src/lib/mailer.ts`.
- Upload variables: `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY` in `src/app/api/imagekit/auth/route.ts`, `src/app/api/imagekit/upload-auth/route.ts`, and `src/app/api/images/auth/route.ts`.
- Payments/config security variables: `CREDENTIAL_ENCRYPTION_KEY`, `PAYPAL_MODE`, `CASHFREE_MODE`, tenant-stored Stripe/Razorpay/PayPal/Cashfree credentials in MongoDB via `src/app/api/events/[id]/payment-gateway/route.ts`.
- Ticket/scanner variables: `TICKET_QR_SECRET` in `src/lib/ticketIssuance.ts`, `src/app/api/scanner/sync/route.ts`, and `src/app/api/scanner/tickets/[ticketCode]/scan/route.ts`.
- GitHub integration variable: optional `GITHUB_TOKEN` in `src/app/api/github-commits/route.ts`.

**Build:**
- `package.json` - scripts and dependencies.
- `package-lock.json` - npm dependency lockfile.
- `next.config.ts` - Next config; currently ignores TypeScript and ESLint build errors and allows remote images from `placehold.co`, `images.unsplash.com`, and `picsum.photos`.
- `tsconfig.json` - strict TypeScript, `@/*` alias to `./src/*`, Next plugin, bundler module resolution.
- `tailwind.config.ts` - Tailwind content paths, theme tokens, container settings, and animation plugin.
- `postcss.config.mjs` - PostCSS/Tailwind processing.
- `components.json` - shadcn-style component aliases and Lucide icon library configuration.
- `vitest.config.ts` - test alias, node environment, serialized file execution, Mongo-related timeouts, and `TICKET_QR_SECRET` test env.
- `apphosting.yaml` - Firebase App Hosting backend settings with `runConfig.maxInstances: 1`.

## Platform Requirements

**Development:**
- Install dependencies with `npm install`.
- Run app with `npm run dev`; the dev server uses port `9002`.
- Run Genkit local tooling with `npm run genkit:dev` or `npm run genkit:watch`.
- Run type checking with `npm run typecheck`.
- Run tests with `npm test`.
- Provide required env vars before hitting server routes that access MongoDB, AI providers, email, payment gateways, ImageKit, Google OAuth, or ticket scanning.

**Production:**
- Deployment target is Vercel according to `README.md` badges and Vercel telemetry in `src/app/layout.tsx`.
- Firebase App Hosting configuration also exists in `apphosting.yaml` and caps backend instances at `1`.
- MongoDB Atlas is expected for production database and vector search because `src/lib/vectorStore.ts` uses MongoDB Atlas `$vectorSearch` and `createSearchIndex`.
- Payment webhooks must be reachable at Next.js API routes under `src/app/api/payments/webhook/**/route.ts`.

---

*Stack analysis: 2026-09-30*
