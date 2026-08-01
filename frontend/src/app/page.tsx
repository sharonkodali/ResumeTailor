import { ArrowRight, FileText, ScanLine, Wand2 } from "lucide-react";
import Link from "next/link";

import Reveal from "./_components/Reveal";
import StepCard from "./_components/StepCard";

// Kept static: the counts a dashboard would show live in the backend, and
// fetching localhost:8000 at build time would break `next build`.
const DESTINATIONS = [
  {
    href: "/vault",
    eyebrow: "Step 1",
    title: "Master Vault",
    description:
      "Every role, project, and bullet point in one place. Add entries by hand, or upload an existing PDF, .docx, or LaTeX resume and import what it finds.",
    cta: "Open the Vault",
    icon: "vault",
    accent: "brown",
  },
  {
    href: "/tailor",
    eyebrow: "Step 2",
    title: "AI Tailor",
    description:
      "Paste a job posting. Your Vault is matched against the role's keywords and rewritten into bullet points aimed at that specific job, with an ATS match score.",
    cta: "Tailor a resume",
    icon: "sparkles",
    accent: "blue",
  },
] as const;

const PIPELINE = [
  {
    icon: FileText,
    title: "Collect once",
    body: "Drop in a resume you already have, or type entries straight into the Vault. Skills are tagged per bullet so they can be matched later.",
  },
  {
    icon: ScanLine,
    title: "Match to the posting",
    body: "The job description is scanned for the keywords and skills that actually matter, then scored against everything in your Vault.",
  },
  {
    icon: Wand2,
    title: "Rewrite, don't invent",
    body: "Your own bullets come back rewritten around the role's language — stronger verbs, the posting's vocabulary, same underlying truth.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-8">
      {/* Hero */}
      <section className="relative overflow-hidden pb-16 pt-16 sm:pt-24">
        {/* Slow-drifting colour fields — the only thing moving at rest. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-24 h-80 w-80 animate-drift rounded-full bg-brown-200/50 blur-3xl" />
          <div className="absolute -right-16 top-10 h-72 w-72 animate-drift-slow rounded-full bg-blue-200/40 blur-3xl" />
          <div className="grain-overlay absolute inset-0" />
        </div>

        <Reveal y={0}>
          <span className="inline-flex items-center gap-2 rounded-full border border-brown-200 bg-white/70 px-3 py-1 text-xs font-medium text-brown-700 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-blue-500" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-600" />
            </span>
            Vault + AI tailoring, running locally
          </span>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            <span className="text-gradient">One vault.</span>
            <br />
            Every resume.
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600">
            Keep your entire work history in a single searchable vault, then
            generate a version of it tuned to whatever job you are applying for.
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/vault"
              className="group inline-flex items-center gap-2 rounded-xl bg-brown-700 px-5 py-3 text-sm font-semibold text-brown-50 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:bg-brown-800 hover:shadow-lift active:translate-y-0"
            >
              Build your Vault
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/tailor"
              className="inline-flex items-center gap-2 rounded-xl border border-brown-200 bg-white px-5 py-3 text-sm font-semibold text-brown-800 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 hover:shadow-lift active:translate-y-0"
            >
              Tailor to a posting
            </Link>
          </div>
        </Reveal>
      </section>

      {/* The two destinations */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {DESTINATIONS.map((step, i) => (
          <StepCard key={step.href} {...step} delay={i * 0.1} />
        ))}
      </section>

      {/* How it works */}
      <section className="mt-20">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold text-brown-950">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">
            Three steps, and nothing is written to your Vault that you did not
            approve first.
          </p>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PIPELINE.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.1}>
              <div className="group h-full rounded-2xl border border-brown-200/70 bg-white/70 p-5 transition-colors duration-300 hover:border-brown-300 hover:bg-white">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brown-100 text-brown-700 transition-colors duration-300 group-hover:bg-blue-100 group-hover:text-blue-700">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="font-mono text-xs text-stone-400">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-brown-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                  {body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Local setup */}
      <Reveal className="mt-20">
        <div className="rounded-2xl border border-brown-200/70 bg-brown-50 p-6">
          <h2 className="text-sm font-semibold text-brown-900">
            Running locally
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
            Both halves need to be up: this app on{" "}
            <code className="rounded border border-brown-200 bg-white px-1.5 py-0.5 font-mono text-xs text-brown-800">
              :3000
            </code>{" "}
            and the FastAPI backend on{" "}
            <code className="rounded border border-brown-200 bg-white px-1.5 py-0.5 font-mono text-xs text-brown-800">
              :8000
            </code>
            . If a page reports it cannot reach the backend, start it with{" "}
            <code className="rounded border border-brown-200 bg-white px-1.5 py-0.5 font-mono text-xs text-brown-800">
              uvicorn main:app --reload
            </code>{" "}
            from the{" "}
            <code className="rounded border border-brown-200 bg-white px-1.5 py-0.5 font-mono text-xs text-brown-800">
              backend/
            </code>{" "}
            folder.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
