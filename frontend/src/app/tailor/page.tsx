'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ClipboardCheck,
  Copy,
  Loader2,
  Sparkles,
  Target,
  Wand2,
  X,
} from 'lucide-react';
import { useState } from 'react';

import ScoreRing from './_components/ScoreRing';

interface TailoredBullet {
  original_text: string;
  tailored_text: string;
  reasoning: string;
}

interface TailorResponse {
  match_score: number;
  extracted_keywords: string[];
  tailored_bullets: TailoredBullet[];
}

export default function TailorPage() {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleTailor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;

    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res = await fetch('http://localhost:8000/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription }),
      });

      if (res.ok) {
        const data: TailorResponse = await res.json();
        setResult(data);
      } else {
        // The backend puts the reason in `detail` — an empty Vault lands here.
        const problem = await res.json().catch(() => null);
        setError(problem?.detail ?? `The tailor request failed (server said ${res.status}).`);
      }
    } catch (error) {
      console.error('Failed to connect to AI tailor backend:', error);
      setError('Could not reach the backend. Is it running on port 8000?');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = () => {
    if (!result) return;
    navigator.clipboard.writeText(
      result.tailored_bullets.map((b) => `• ${b.tailored_text}`).join('\n')
    );
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-8">
      {/* Header */}
      <div className="border-b border-brown-200/70 pb-6">
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-semibold text-brown-950">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-card">
            <Wand2 className="h-5 w-5" />
          </span>
          AI Resume Tailor
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Paste a target job posting below. Your Master Vault is matched against
          the role keywords and rewritten into optimized bullet points.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleTailor} className="space-y-4">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label
              htmlFor="job-description"
              className="text-sm font-semibold text-brown-900"
            >
              Target Job Description
            </label>
            <span className="font-mono text-xs text-stone-400">
              {jobDescription.length} chars
            </span>
          </div>

          <div className="relative">
            <textarea
              id="job-description"
              rows={9}
              required
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here (e.g., qualifications, key responsibilities, required skills)..."
              className="w-full resize-y rounded-xl border border-brown-200 bg-white p-4 text-sm text-brown-950 shadow-card transition placeholder:text-stone-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {jobDescription && (
              <button
                type="button"
                onClick={() => setJobDescription('')}
                aria-label="Clear job description"
                className="absolute right-3 top-3 rounded-md p-1 text-stone-400 transition hover:bg-brown-50 hover:text-brown-800"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={loading || !jobDescription.trim()}
          whileHover={loading || !jobDescription.trim() ? undefined : { y: -2 }}
          whileTap={loading || !jobDescription.trim() ? undefined : { y: 0, scale: 0.995 }}
          className={`w-full rounded-xl py-3.5 text-sm font-semibold shadow-card transition-colors duration-200 ${
            loading || !jobDescription.trim()
              ? 'cursor-not-allowed bg-stone-200 text-stone-500'
              : 'bg-gradient-to-r from-brown-700 to-blue-700 text-white hover:shadow-lift'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing &amp; rewriting with AI...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Tailor My Resume
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
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton — keeps the page from collapsing while GPT works. */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="shimmer h-40 rounded-2xl" />
            <div className="shimmer h-40 rounded-2xl md:col-span-2" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="shimmer h-44 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Results Section */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            {/* Analytics Summary */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-brown-200/70 bg-white p-6 shadow-card">
                <ScoreRing score={result.match_score} />
              </div>

              <div className="space-y-3 rounded-2xl border border-brown-200/70 bg-white p-6 shadow-card md:col-span-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
                  <Target className="h-3.5 w-3.5 text-blue-600" />
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
                      className="cursor-default rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100"
                    >
                      {kw}
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>

            {/* Side-by-Side Tailored Bullets */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-brown-950">
                  Tailored Bullet Points
                  <span className="ml-2 font-sans text-sm font-medium text-stone-400">
                    {result.tailored_bullets.length}
                  </span>
                </h2>
                {result.tailored_bullets.length > 0 && (
                  <button
                    onClick={copyAll}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brown-200 bg-white px-3 py-1.5 text-xs font-semibold text-brown-800 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700"
                  >
                    {copiedAll ? (
                      <>
                        <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" />
                        Copied all
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy all
                      </>
                    )}
                  </button>
                )}
              </div>

              {result.tailored_bullets.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.08, duration: 0.4 }}
                  className="space-y-4 rounded-2xl border border-brown-200/70 bg-white p-6 shadow-card transition-shadow duration-200 hover:shadow-lift"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Original — the Vault side, in brown */}
                    <div className="space-y-1.5 rounded-xl border border-brown-200/70 bg-brown-50/70 p-4">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brown-600">
                        From your Vault
                      </span>
                      <p className="text-sm leading-relaxed text-stone-700">
                        {item.original_text}
                      </p>
                    </div>

                    {/* Tailored — the AI side, in blue */}
                    <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                          AI tailored version
                        </span>
                        <button
                          onClick={() => copyToClipboard(item.tailored_text, index)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 transition hover:text-blue-900"
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            {copiedIndex === index ? (
                              <motion.span
                                key="copied"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="inline-flex items-center gap-1"
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" />
                                Copied
                              </motion.span>
                            ) : (
                              <motion.span
                                key="copy"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="inline-flex items-center gap-1"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-brown-950">
                        {item.tailored_text}
                      </p>
                    </div>
                  </div>

                  {/* Reasoning */}
                  {item.reasoning && (
                    <div className="border-t border-brown-100 pt-3 text-xs leading-relaxed text-stone-500">
                      <span className="font-semibold text-brown-800">
                        Optimization note:{' '}
                      </span>
                      {item.reasoning}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
