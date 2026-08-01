'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Loader2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';

const API = 'http://localhost:8000';
const ACCEPTED = '.pdf,.docx,.tex';
const CATEGORIES = ['Work', 'Project', 'Research', 'Leadership'] as const;

interface DraftBullet {
  text: string;
  skills: string;
  selected: boolean;
}

interface DraftExperience {
  company: string;
  role: string;
  dates: string;
  category: string;
  bullets: DraftBullet[];
  selected: boolean;
}

interface UploadResponse {
  filename: string;
  ai_structured: boolean;
  experiences: {
    company: string;
    role: string;
    dates: string;
    category: string;
    bullets: { text: string; skills: string }[];
  }[];
}

export default function ResumeUpload({ onImported }: { onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [filename, setFilename] = useState('');
  const [aiStructured, setAiStructured] = useState(true);
  const [drafts, setDrafts] = useState<DraftExperience[] | null>(null);

  const selectedCount = drafts?.filter((d) => d.selected).length ?? 0;

  const handleFile = async (file: File) => {
    setParsing(true);
    setError('');
    setDrafts(null);

    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch(`${API}/api/resume/upload`, { method: 'POST', body });

      if (!res.ok) {
        // FastAPI puts the human-readable reason in `detail`.
        const problem = await res.json().catch(() => null);
        setError(problem?.detail ?? `Upload failed (server said ${res.status}).`);
        return;
      }

      const data: UploadResponse = await res.json();
      setFilename(data.filename);
      setAiStructured(data.ai_structured);
      setDrafts(
        data.experiences.map((exp) => ({
          ...exp,
          selected: true,
          bullets: exp.bullets.map((b) => ({ ...b, selected: true })),
        }))
      );
    } catch (err) {
      console.error('Failed to upload resume:', err);
      setError('Could not reach the backend. Is it running on port 8000?');
    } finally {
      setParsing(false);
      // Let the same file be picked again after a failed parse.
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const updateDraft = (index: number, patch: Partial<DraftExperience>) => {
    setDrafts((current) =>
      current?.map((d, i) => (i === index ? { ...d, ...patch } : d)) ?? null
    );
  };

  const toggleBullet = (expIndex: number, bulletIndex: number) => {
    setDrafts(
      (current) =>
        current?.map((d, i) =>
          i === expIndex
            ? {
                ...d,
                bullets: d.bullets.map((b, j) =>
                  j === bulletIndex ? { ...b, selected: !b.selected } : b
                ),
              }
            : d
        ) ?? null
    );
  };

  const discard = () => {
    setDrafts(null);
    setFilename('');
    setError('');
  };

  const handleImport = async () => {
    if (!drafts) return;

    const experiences = drafts
      .filter((d) => d.selected)
      .map((d) => ({
        company: d.company,
        role: d.role,
        dates: d.dates,
        category: d.category,
        bullets: d.bullets
          .filter((b) => b.selected)
          .map((b) => ({ text: b.text, skills: b.skills })),
      }));

    if (experiences.length === 0) {
      setError('Select at least one experience to import.');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const res = await fetch(`${API}/api/experiences/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experiences }),
      });

      if (res.ok) {
        discard();
        onImported();
      } else {
        const problem = await res.json().catch(() => null);
        setError(problem?.detail ?? `Import failed (server said ${res.status}).`);
      }
    } catch (err) {
      console.error('Failed to import experiences:', err);
      setError('Could not reach the backend to import those experiences.');
    } finally {
      setImporting(false);
    }
  };

  const draftInput =
    'rounded-lg border border-brown-200 bg-white px-2.5 py-2 text-sm text-brown-950 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200';

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <motion.div
        animate={{ scale: dragging ? 1.01 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-200 ${
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-brown-200 bg-brown-50/60 hover:border-brown-300'
        }`}
      >
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <motion.span
          animate={
            parsing
              ? { y: 0 }
              : dragging
                ? { y: -6, scale: 1.1 }
                : { y: [0, -4, 0] }
          }
          transition={
            parsing || dragging
              ? { type: 'spring', stiffness: 300, damping: 18 }
              : { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }
          }
          className={`mx-auto grid h-12 w-12 place-items-center rounded-xl shadow-card ${
            dragging
              ? 'bg-blue-600 text-white'
              : 'bg-white text-brown-700'
          }`}
        >
          {parsing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </motion.span>

        <p className="mt-4 font-display text-base font-semibold text-brown-900">
          {parsing
            ? 'Reading your resume...'
            : dragging
              ? 'Drop it here'
              : 'Import from an existing resume'}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Drop a PDF, .docx, or LaTeX (.tex) file here — or
        </p>

        <button
          type="button"
          disabled={parsing}
          onClick={() => fileInput.current?.click()}
          className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold shadow-card transition-all duration-200 ${
            parsing
              ? 'cursor-not-allowed bg-stone-200 text-stone-500'
              : 'bg-brown-700 text-brown-50 hover:-translate-y-0.5 hover:bg-brown-800 hover:shadow-lift'
          }`}
        >
          {parsing ? 'Parsing...' : 'Choose a file'}
        </button>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {['.pdf', '.docx', '.tex'].map((ext) => (
            <span
              key={ext}
              className="rounded-md border border-brown-200 bg-white px-2 py-0.5 font-mono text-[10px] text-brown-700"
            >
              {ext}
            </span>
          ))}
        </div>
      </motion.div>

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

      {/* Review panel — nothing is saved until the user confirms */}
      <AnimatePresence>
        {drafts && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5 rounded-2xl border border-brown-200/70 bg-white p-6 shadow-card"
          >
            <div className="flex items-start justify-between gap-4 border-b border-brown-100 pb-4">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-brown-950">
                  <FileText className="h-4.5 w-4.5 text-blue-600" />
                  Review what we found in {filename}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  {drafts.length} experience{drafts.length === 1 ? '' : 's'}{' '}
                  detected. Uncheck anything you do not want, then import.
                  Nothing is saved until you do.
                </p>
              </div>
              <button
                type="button"
                onClick={discard}
                className="shrink-0 text-xs font-semibold text-stone-500 transition hover:text-brown-900"
              >
                Discard
              </button>
            </div>

            {!aiStructured && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                The AI structuring step was unavailable, so this resume was split
                up heuristically. Check the company, role, and dates on each
                entry before importing.
              </div>
            )}

            {drafts.map((draft, i) => (
              <motion.div
                key={i}
                layout
                className={`space-y-3 rounded-xl border p-4 transition-colors duration-200 ${
                  draft.selected
                    ? 'border-brown-200/70 bg-white'
                    : 'border-stone-200 bg-stone-50 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={draft.selected}
                    onChange={() => updateDraft(i, { selected: !draft.selected })}
                    className="mt-2.5 h-4 w-4 shrink-0 accent-blue-600"
                  />
                  <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-4">
                    <input
                      value={draft.company}
                      onChange={(e) => updateDraft(i, { company: e.target.value })}
                      placeholder="Company"
                      className={`${draftInput} font-semibold`}
                    />
                    <input
                      value={draft.role}
                      onChange={(e) => updateDraft(i, { role: e.target.value })}
                      placeholder="Role"
                      className={draftInput}
                    />
                    <input
                      value={draft.dates}
                      onChange={(e) => updateDraft(i, { dates: e.target.value })}
                      placeholder="Dates"
                      className={draftInput}
                    />
                    <select
                      value={draft.category}
                      onChange={(e) => updateDraft(i, { category: e.target.value })}
                      className={draftInput}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <ul className="space-y-2 pl-7">
                  {draft.bullets.map((bullet, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={bullet.selected}
                        disabled={!draft.selected}
                        onChange={() => toggleBullet(i, j)}
                        className="mt-1 h-3.5 w-3.5 shrink-0 accent-blue-600"
                      />
                      <div className="flex-1">
                        <p
                          className={`text-sm transition-colors ${
                            bullet.selected
                              ? 'text-stone-700'
                              : 'text-stone-400 line-through'
                          }`}
                        >
                          {bullet.text}
                        </p>
                        {bullet.skills && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {bullet.skills.split(',').map((skill, k) => (
                              <span
                                key={k}
                                className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-700"
                              >
                                {skill.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                  {draft.bullets.length === 0 && (
                    <li className="text-xs italic text-stone-400">
                      No bullet points found for this entry — you can add them
                      after importing.
                    </li>
                  )}
                </ul>
              </motion.div>
            ))}

            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className={`w-full rounded-lg py-2.5 text-sm font-semibold shadow-card transition-all duration-200 ${
                importing || selectedCount === 0
                  ? 'cursor-not-allowed bg-stone-200 text-stone-500'
                  : 'bg-blue-700 text-white hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-lift'
              }`}
            >
              {importing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </span>
              ) : (
                `Import ${selectedCount} experience${selectedCount === 1 ? '' : 's'} to Vault`
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
