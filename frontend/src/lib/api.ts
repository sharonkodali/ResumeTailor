/**
 * Base URL of the FastAPI backend.
 *
 * Set via NEXT_PUBLIC_API_URL so the frontend can point at a deployed backend
 * without a code change. Next inlines this at build time rather than reading
 * it at runtime, so a build promoted between environments keeps whatever value
 * `next build` saw — set it before building, not before starting.
 *
 * The fallback keeps `npm run dev` working on a fresh clone with no .env.local.
 */
export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
