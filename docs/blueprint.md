# **App Name**: Nocta

## Core Features:

- User Authentication: Enable user registration and login through email/password or Google OAuth for secure, multi-tenant access.
- Website Data Ingestion: Provide a mechanism to crawl specified websites, extract relevant content, and embed it into a vector database to build the chatbot's knowledge base.
- AI Chatbot Engine: Serve conversational AI responses, using the ingested data as a retrieval augmented generation (RAG) tool to inform the Groq LLM and stream outputs to users.
- Chatbot Customization: Allow users to configure their chatbot's persona, system prompt, appearance (name, icon), and visual theme (colors).
- Embeddable Chat Widget: Generate a pure JavaScript widget that can be embedded into any website, displaying the customized chatbot with real-time conversation and session history.
- Usage and Analytics Dashboard: Present users with a dashboard to monitor their chatbot's performance, message usage statistics, and subscription plan details.
- Subscription and Billing: Integrate with Razorpay and Stripe to manage user subscriptions, handle payments for plan upgrades, and enforce usage limits.

## Style Guidelines:

- Primary color: Muted Lavender (#9999CC). This serves as a sophisticated, calm highlight color against the dark backdrop, guiding user attention without being overly bold.
- Background color: Deep Cool Grey (#16161B). A very dark, almost black hue with a subtle cool undertone, setting an elegant and 'night' inspired aesthetic, reminiscent of the xAI dark theme.
- Accent color: Vibrant Cyan-Blue (#2699D9). A striking and clear blue used for critical interactive elements, calls to action, and indicators to ensure high visibility and a modern tech feel.
- All UI text will use the 'Inter' sans-serif typeface, selected for its modern, legible, and neutral aesthetic that complements the dark, minimal interface.
- Code snippets and script displays will use the 'Source Code Pro' monospace font to maintain readability and a consistent developer-friendly presentation.
- Utilize simple, clean line-art icons from the Lucide set, adhering to a minimalist and functional approach that aligns with the tech-focused, dark aesthetic.
- The dashboard will feature a Vercel-inspired dark sidebar navigation with clearly segmented content areas, prioritizing information hierarchy and ease of access on both desktop and mobile.
- Implement subtle, fast-paced transitions and loading indicators, such as those during crawling progress or chat response streaming, to provide user feedback without distracting from the core functionality.