# Frontend — ResumeTailor UI

Next.js 16 App Router client for the ResumeTailor API. React 19, TypeScript in
strict mode, Tailwind CSS v4, framer-motion for transitions.

The landing page and root layout are server components; `/vault`, `/tailor`,
and `/tailor/latex` are client components. The interesting state on those three
(an in-progress tailoring run, a PDF compile, a diff being reviewed) is
user-driven and lives in the browser, so there is no server-side data fetching.

## Routes

| Route | What it does |
| --- | --- |
| `/` | Landing page. Deliberately static — the counts a dashboard would show live in the backend, and fetching them at build time would break `next build`. |
| `/vault` | The Master Vault: CRUD over experiences and their bullets, plus resume upload that parses a `.pdf` / `.docx` / `.tex` into draft entries. |
| `/tailor` | Paste a job description, get rewritten bullets, a match score, and per-bullet reasoning. |
| `/tailor/latex` | Pick or upload a base `.tex`, tailor it in place, review a side-by-side diff, and compile a live PDF preview. |

## Layout

| Path | What it holds |
| --- | --- |
| `src/app/` | Routes; `_components/` folders hold their route-local pieces |
| `src/components/` | Components shared across routes |
| `src/lib/api.ts` | Backend base URL — the single place it is configured |
| `src/lib/diff.ts` | Line-level LCS diff powering the LaTeX side-by-side view |

## Running it standalone

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Serves on `http://localhost:3000`.

**It needs the backend running.** There is no mock layer — with the API down,
every page loads but each action reports a connection error. Start
`backend/` first (see `backend/README.md`).

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm start` | Serve a production build |
| `npm run lint` | ESLint |

## Setup quirks

**`NEXT_PUBLIC_API_URL`** points at the backend, defaulting to
`http://localhost:8000` when unset — a fresh clone runs without any `.env.local`
at all. Copy `.env.local.example` when you need to override it.

The `NEXT_PUBLIC_` prefix means Next **inlines the value at build time**, not at
runtime. A production build carries whatever the variable was when
`next build` ran, so a single build promoted across environments cannot be
repointed by changing the variable and restarting — set it before building.

Read it through `src/lib/api.ts` rather than reaching for `process.env`
directly. Under `strict` the raw lookup is `string | undefined` and would
silently produce URLs like `undefined/api/experiences`; the shared constant
supplies the fallback. Keep the reference statically analyzable — Next only
substitutes literal `process.env.NEXT_PUBLIC_*` expressions, so destructuring
`process.env` or indexing it with a variable quietly stops working in the
browser bundle.

**CORS** on the backend allows only `localhost:3000` and `:3001`. Running the
dev server on another port means widening that list in `backend/main.py`.

**`.env*` is gitignored wholesale**, with an explicit `!.env.local.example`
negation so the template stays committed. New example files need the same
treatment or they will vanish from `git status`.
