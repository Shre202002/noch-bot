import Link from "next/link";

const docs = [
  {
    title: "Getting Started",
    desc: "Create your NochBot account and configure your first chatbot.",
  },
  {
    title: "Website Crawling",
    desc: "Learn how NochBot crawls and indexes website content using vector embeddings.",
  },
  {
    title: "Embedding",
    desc: "Add NochBot to any website using a lightweight embed script.",
  },
  {
    title: "Theme Customization",
    desc: "Customize colors, branding, icons and chatbot appearance.",
  },
  {
    title: "Analytics",
    desc: "Track conversations, visitor activity and chatbot performance.",
  },
  {
    title: "AI Responses",
    desc: "Understand how retrieval-augmented generation (RAG) powers responses.",
  },
  {
    title: "Authentication",
    desc: "Login, Google OAuth, account security and session management.",
  },
  {
    title: "API & Integrations",
    desc: "Integrate NochBot with external systems and workflows.",
  },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-20">

      <div className="mx-auto max-w-6xl">

        <div className="mb-16">

          <h1 className="text-5xl font-bold mb-5">
            Documentation
          </h1>

          <p className="max-w-2xl text-zinc-400 text-lg leading-8">
            Learn how to build, deploy and manage AI-powered chatbots
            using NochBot.
          </p>

        </div>

        <div className="grid gap-6 md:grid-cols-2">

          {docs.map((doc) => (
            <Link
              key={doc.title}
              href="#"
              className="rounded-3xl border border-white/10 bg-white/5 p-8 transition-all hover:bg-white/10"
            >

              <h2 className="text-2xl font-semibold mb-4">
                {doc.title}
              </h2>

              <p className="text-zinc-400 leading-7">
                {doc.desc}
              </p>

            </Link>
          ))}

        </div>

      </div>

    </main>
  );
}