import Link from "next/link";

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
  },
  {
    href: "/tailor",
    eyebrow: "Step 2",
    title: "AI Tailor",
    description:
      "Paste a job posting. Your Vault is matched against the role's keywords and rewritten into bullet points aimed at that specific job, with an ATS match score.",
    cta: "Tailor a resume",
  },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto p-8 space-y-10">
      <div className="border-b pb-8 pt-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          One vault. Every resume.
        </h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          Keep your entire work history in a single searchable vault, then generate a
          version of it tuned to whatever job you are applying for.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {DESTINATIONS.map(({ href, eyebrow, title, description, cta }) => (
          <Link
            key={href}
            href={href}
            className="group border rounded-xl p-6 bg-white shadow-2xs space-y-3 hover:border-blue-300 hover:shadow-md transition"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              {eyebrow}
            </span>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
            <span className="inline-block text-sm font-semibold text-blue-600 group-hover:underline">
              {cta} &rarr;
            </span>
          </Link>
        ))}
      </div>

      <div className="border rounded-xl bg-slate-50 p-6">
        <h2 className="text-sm font-semibold text-gray-800">Running locally</h2>
        <p className="text-sm text-gray-600 mt-1">
          Both halves need to be up: this app on{" "}
          <code className="text-xs bg-white border rounded px-1.5 py-0.5">:3000</code> and
          the FastAPI backend on{" "}
          <code className="text-xs bg-white border rounded px-1.5 py-0.5">:8000</code>. If
          a page reports it cannot reach the backend, start it with{" "}
          <code className="text-xs bg-white border rounded px-1.5 py-0.5">
            uvicorn main:app --reload
          </code>{" "}
          from the <code className="text-xs bg-white border rounded px-1.5 py-0.5">backend/</code>{" "}
          folder.
        </p>
      </div>
    </div>
  );
}
