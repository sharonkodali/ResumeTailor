'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  FileCode,
  Info,
  Loader2,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import LatexDiff from '../_components/LatexDiff';
import ScoreRing from '../_components/ScoreRing';
import PdfPreview from './_components/PdfPreview';
import SourcePicker, { type ResumeSource } from './_components/SourcePicker';

const API = 'http://localhost:8000';

interface LatexChange {
  original: string;
  tailored: string;
  reasoning: string;
}

interface LatexTailorResponse {
  original_latex: string;
  tailored_latex: string;
  changes: LatexChange[];
  match_score: number;
  extracted_keywords: string[];
  ai_tailored: boolean;
}

export default function LatexTailorPage() {
  const [source, setSource] = useState<ResumeSource | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LatexTailorResponse | null>(null);

  const ready = source !== null && jobDescription.trim().length > 0;

  const handleTailor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;

    setLoading(true);
    // Dropping the old result also unmounts the PDF preview, so a stale
    // render of the previous document cannot sit under the new diff.
    setResult(null);
    setError('');

    try {
      const res = await fetch(`${API}/api/resume/tailor-latex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_description: jobDescription,
          source_id: source.id,
        }),
      });

      if (!res.ok) {
        // FastAPI puts the human-readable reason in `detail`.
        const problem = await res.json().catch(() => null);
        setError(problem?.detail ?? `Tailoring failed (server said ${res.status}).`);
        return;
      }

      setResult(await res.json());
    } catch (err) {
      console.error('Failed to tailor the LaTeX resume:', err);
      setError('Could not reach the backend. Is it running on port 8000?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-8">
      {/* Header */}
      <div className="border-b border-ash-600 pb-6">
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-semibold text-ash-50">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-ash-50 text-ash-950">
            <FileCode className="h-5 w-5" />
          </span>
          LaTeX Resume Tailor
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ash-100">
          Rewrites the bullet points inside your actual{' '}
          <code className="font-mono text-ash-50">.tex</code> resume for a
          specific posting. The model never writes the document — it only
          rewrites bullet text, which is spliced back at its original offsets,
          so your preamble, macros, header, and education come through
          byte-identical and the file still compiles.
        </p>
        <p className="mt-3 text-xs text-ash-300">
          Want rewritten bullets to copy by hand instead?{' '}
          <Link
            href="/tailor"
            className="font-semibold text-ash-100 underline transition hover:text-ash-50"
          >
            Use the Vault-based tailor
          </Link>
          .
        </p>
      </div>

      <SourcePicker selectedId={source?.id ?? null} onSelect={setSource} />

      {/* Job description */}
      <form
        onSubmit={handleTailor}
        className="space-y-4 rounded-2xl border border-ash-600 bg-ash-900 p-6 shadow-card"
      >
        <div>
          <h2 className="font-display text-lg font-semibold text-ash-50">
            2. Paste the job description
          </h2>
          <p className="mt-1 text-xs text-ash-200">
            Keywords are pulled from this and worked into your bullets — but
            only where your original already supports them.
          </p>
        </div>

        <div className="relative">
          <textarea
            id="job-description"
            rows={8}
            required
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here (qualifications, responsibilities, required skills)..."
            className="w-full resize-y rounded-xl border border-ash-600 bg-ash-800 p-4 text-sm text-ash-50 transition placeholder:text-ash-300 focus:border-ash-300 focus:outline-none focus:ring-2 focus:ring-ash-500"
          />
          {jobDescription && (
            <button
              type="button"
              onClick={() => setJobDescription('')}
              aria-label="Clear job description"
              className="absolute right-3 top-3 rounded-md p-1 text-ash-300 transition hover:bg-ash-700 hover:text-ash-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-ash-300">
            {jobDescription.length} chars
          </span>
          {source ? (
            <span className="truncate text-xs text-ash-200">
              Tailoring{' '}
              <span className="font-semibold text-ash-50">{source.name}</span>
            </span>
          ) : (
            <span className="text-xs text-ash-300">
              Pick a base resume above first
            </span>
          )}
        </div>

        <motion.button
          type="submit"
          disabled={loading || !ready}
          whileHover={loading || !ready ? undefined : { y: -2 }}
          whileTap={loading || !ready ? undefined : { y: 0, scale: 0.995 }}
          className={`w-full rounded-xl py-3.5 text-sm font-semibold shadow-card transition-colors duration-200 ${
            loading || !ready
              ? 'cursor-not-allowed bg-ash-700 text-ash-300'
              : 'bg-ash-50 text-ash-950 hover:bg-white hover:shadow-lift'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Rewriting your bullets...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Tailor this resume
              </>
            )}
          </span>
        </motion.button>
      </form>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton — keeps the page from collapsing while the model works. */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="shimmer h-40 rounded-2xl" />
            <div className="shimmer h-40 rounded-2xl md:col-span-2" />
          </div>
          <div className="shimmer h-96 rounded-2xl" />
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            {!result.ai_tailored && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-200">
                No tailoring model was available, so your document was returned
                unchanged rather than edited by a lesser heuristic. Set{' '}
                <code className="font-mono">OPENAI_API_KEY</code> in{' '}
                <code className="font-mono">backend/.env</code> and try again.
              </div>
            )}

            {result.ai_tailored && (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="rounded-2xl border border-ash-600 bg-ash-900 p-6 shadow-card">
                    <ScoreRing score={result.match_score} />
                  </div>

                  <div className="space-y-3 rounded-2xl border border-ash-600 bg-ash-900 p-6 shadow-card md:col-span-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ash-200">
                      <Target className="h-3.5 w-3.5 text-ash-50" />
                      Extracted Job Keywords
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {result.extracted_keywords.map((kw, i) => (
                        <motion.span
                          key={`${kw}-${i}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.15 + i * 0.04, duration: 0.25 }}
                          whileHover={{ y: -2 }}
                          className="cursor-default rounded-lg border border-ash-500 bg-ash-700 px-2.5 py-1 text-xs font-medium text-ash-50 transition-colors hover:border-ash-400 hover:bg-ash-600"
                        >
                          {kw}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Change list */}
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-semibold text-ash-50">
                    Rewritten Bullets
                    <span className="ml-2 font-sans text-sm font-medium text-ash-300">
                      {result.changes.length}
                    </span>
                  </h2>

                  {result.changes.length === 0 && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-ash-600 bg-ash-900 px-4 py-4 text-sm leading-relaxed text-ash-200">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-ash-100" />
                      <span>
                        Nothing was rewritten. Every bullet was either already
                        well targeted for this posting or could not be improved
                        without inventing something your original did not
                        claim — an unchanged bullet beats a padded one.
                      </span>
                    </div>
                  )}

                  {result.changes.map((change, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.08, duration: 0.4 }}
                      className="space-y-4 rounded-2xl border border-ash-600 bg-ash-900 p-6 shadow-card transition-shadow duration-200 hover:shadow-lift"
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Original — sunken, one step dimmer */}
                        <div className="space-y-1.5 rounded-xl border border-ash-600 bg-ash-800 p-4">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-ash-200">
                            In your document
                          </span>
                          <p className="text-sm leading-relaxed text-ash-100">
                            {change.original}
                          </p>
                        </div>

                        {/* Tailored — raised, full white */}
                        <div className="space-y-1.5 rounded-xl border border-ash-500 bg-ash-700 p-4">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-ash-50">
                            Tailored for this role
                          </span>
                          <p className="text-sm font-medium leading-relaxed text-ash-50">
                            {change.tailored}
                          </p>
                        </div>
                      </div>

                      {change.reasoning && (
                        <div className="border-t border-ash-600 pt-3 text-xs leading-relaxed text-ash-200">
                          <span className="font-semibold text-ash-100">
                            Optimization note:{' '}
                          </span>
                          {change.reasoning}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {/* Source diff — the proof that only bullet text moved */}
            <div className="space-y-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-ash-50">
                  Source Diff
                </h2>
                <p className="mt-1 text-xs text-ash-200">
                  Every line of your template that is not a rewritten bullet is
                  identical on both sides.
                </p>
              </div>
              <LatexDiff
                original={result.original_latex}
                tailored={result.tailored_latex}
              />
            </div>

            <PdfPreview
              original={result.original_latex}
              tailored={result.tailored_latex}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
