'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileText, Loader2, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

const API = 'http://localhost:8000';

interface CompilerStatus {
  available: boolean;
  engine: string | null;
  hint: string | null;
}

type Which = 'tailored' | 'original';

/**
 * Compiles a document to PDF and previews it inline.
 *
 * Compilation is on demand rather than automatic: it shells out to a LaTeX
 * engine, so it should happen when the user asks for it, not on every render
 * of a results panel they may only be skimming.
 */
export default function PdfPreview({
  original,
  tailored,
}: {
  original: string;
  tailored: string;
}) {
  const [status, setStatus] = useState<CompilerStatus | null>(null);
  const [which, setWhich] = useState<Which>('tailored');
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState<string | null>(null);

  const latex = which === 'tailored' ? tailored : original;

  useEffect(() => {
    fetch(`${API}/api/resume/compiler`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status)))
      )
      .then((data: CompilerStatus) => setStatus(data))
      .catch((err) => {
        console.error('Failed to read compiler status:', err);
        setStatus({ available: false, engine: null, hint: null });
      });
  }, []);

  // Revokes the previous object URL whenever it is replaced, and the last one
  // on unmount — an un-revoked PDF blob is held for the life of the document.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const selectWhich = (next: Which) => {
    setWhich(next);
    // The rendered PDF belongs to the other document now.
    setUrl(null);
    setError('');
  };

  const compile = async () => {
    setCompiling(true);
    setError('');

    try {
      const res = await fetch(`${API}/api/resume/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex }),
      });

      if (!res.ok) {
        // A 422 carries the engine's own error text, which is what names the
        // offending line — far more useful than "compilation failed".
        const problem = await res.json().catch(() => null);
        setError(problem?.detail ?? `Compiling failed (server said ${res.status}).`);
        return;
      }

      setUrl(URL.createObjectURL(await res.blob()));
    } catch (err) {
      console.error('Failed to compile the resume:', err);
      setError('Could not reach the backend to compile that document.');
    } finally {
      setCompiling(false);
    }
  };

  const downloadTex = () => {
    const blob = new Blob([latex], { type: 'application/x-tex' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = which === 'tailored' ? 'resume-tailored.tex' : 'resume-original.tex';
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-ash-600 bg-ash-900 p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ash-50">
          <FileText className="h-4.5 w-4.5 text-ash-200" />
          Preview &amp; download
        </h2>

        {/* Which document — the tailored one is the point, but compiling the
            original proves the rewrite did not break anything. */}
        <div className="flex rounded-lg border border-ash-600 bg-ash-800 p-0.5">
          {(['tailored', 'original'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => selectWhich(option)}
              className={`relative rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                which === option ? 'text-ash-950' : 'text-ash-200 hover:text-ash-50'
              }`}
            >
              {which === option && (
                <motion.span
                  layoutId="pdf-which-pill"
                  className="absolute inset-0 rounded-md bg-ash-50"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative">{option}</span>
            </button>
          ))}
        </div>
      </div>

      {status && !status.available && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
          {status.hint ??
            'No LaTeX engine is installed on the backend, so PDF preview is unavailable.'}{' '}
          You can still download the <code className="font-mono">.tex</code>{' '}
          and compile it yourself.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={compile}
          disabled={compiling || !status?.available}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-card transition-all duration-200 ${
            compiling || !status?.available
              ? 'cursor-not-allowed bg-ash-700 text-ash-300'
              : 'bg-ash-50 text-ash-950 hover:-translate-y-0.5 hover:bg-white hover:shadow-lift'
          }`}
        >
          {compiling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Compiling...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Compile to PDF
            </>
          )}
        </button>

        <button
          type="button"
          onClick={downloadTex}
          className="inline-flex items-center gap-2 rounded-lg border border-ash-500 bg-ash-700 px-4 py-2 text-sm font-semibold text-ash-50 transition hover:-translate-y-0.5 hover:bg-ash-600"
        >
          <Download className="h-4 w-4" />
          Download .tex
        </button>

        {url && (
          <a
            href={url}
            download={
              which === 'tailored' ? 'resume-tailored.pdf' : 'resume-original.pdf'
            }
            className="inline-flex items-center gap-2 rounded-lg border border-ash-500 bg-ash-700 px-4 py-2 text-sm font-semibold text-ash-50 transition hover:-translate-y-0.5 hover:bg-ash-600"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* The engine's message is preformatted and names line numbers. */}
            <pre className="scroll-warm overflow-x-auto rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-rose-300">
              {error}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {url && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-xl border border-ash-600 bg-ash-800"
          >
            <iframe
              src={url}
              title={`Compiled ${which} resume`}
              className="h-[40rem] w-full"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
