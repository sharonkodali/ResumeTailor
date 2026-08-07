'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  FileCode,
  Loader2,
  PencilLine,
  Trash2,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import ConfirmDialog from '../../../_components/ConfirmDialog';

const API = 'http://localhost:8000';

export interface ResumeSource {
  id: number;
  name: string;
  created_at: string;
}

/*
 * Four ways to get a base resume into the picker. Everything ends up as a
 * stored source with an id, including pasted LaTeX — the tailor request then
 * has exactly one shape (`source_id`) instead of branching on where the
 * document came from.
 */
type Mode = 'stored' | 'upload' | 'paste' | 'generate';

const MODES: { key: Mode; label: string; icon: typeof FileCode }[] = [
  { key: 'stored', label: 'Saved', icon: FileCode },
  { key: 'upload', label: 'Upload .tex', icon: UploadCloud },
  { key: 'paste', label: 'Paste', icon: PencilLine },
  { key: 'generate', label: 'From Vault', icon: Wand2 },
];

const FIELD =
  'w-full rounded-lg border border-ash-500 bg-ash-700 px-2.5 py-2 text-sm text-ash-50 transition placeholder:text-ash-300 focus:border-ash-300 focus:outline-none focus:ring-2 focus:ring-ash-500';

export default function SourcePicker({
  selectedId,
  onSelect,
}: {
  selectedId: number | null;
  onSelect: (source: ResumeSource | null) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>('stored');
  const [sources, setSources] = useState<ResumeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ResumeSource | null>(null);

  // Paste form
  const [pasteName, setPasteName] = useState('');
  const [pasteLatex, setPasteLatex] = useState('');

  // Generate-from-Vault form. The Vault stores experiences only, so identity,
  // education, and the skills line have to be supplied here.
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    links: '',
    education: '',
    skills: '',
  });
  const [generateName, setGenerateName] = useState('');

  // Promise callbacks rather than await, matching the Vault page: state must
  // not be set synchronously inside the mount effect.
  const loadSources = () =>
    fetch(`${API}/api/resume/sources`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status)))
      )
      .then((data: ResumeSource[]) => setSources(data))
      .catch((err) => {
        console.error('Failed to load resume sources:', err);
        setError('Could not reach the backend. Is it running on port 8000?');
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    loadSources();
  }, []);

  /** Shared tail of every "create a source" path. */
  const adopt = async (res: Response, fallback: string) => {
    if (!res.ok) {
      // FastAPI puts the human-readable reason in `detail`.
      const problem = await res.json().catch(() => null);
      setError(problem?.detail ?? fallback);
      return;
    }

    const created: ResumeSource = await res.json();
    setError('');
    await loadSources();
    onSelect(created);
    setMode('stored');
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError('');

    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch(`${API}/api/resume/sources/upload`, {
        method: 'POST',
        body,
      });
      await adopt(res, `Upload failed (server said ${res.status}).`);
    } catch (err) {
      console.error('Failed to upload .tex source:', err);
      setError('Could not reach the backend to upload that file.');
    } finally {
      setBusy(false);
      // Let the same file be picked again after a failed upload.
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handlePaste = async () => {
    if (!pasteLatex.trim()) {
      setError('Paste the LaTeX source of your resume first.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch(`${API}/api/resume/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pasteName.trim() || 'Pasted resume',
          latex: pasteLatex,
        }),
      });

      await adopt(res, `Could not save that source (server said ${res.status}).`);
      if (res.ok) {
        setPasteLatex('');
        setPasteName('');
      }
    } catch (err) {
      console.error('Failed to save pasted source:', err);
      setError('Could not reach the backend to save that source.');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    setBusy(true);
    setError('');

    try {
      const res = await fetch(`${API}/api/resume/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: {
            ...profile,
            links: profile.links
              .split(',')
              .map((link) => link.trim())
              .filter(Boolean),
          },
          // Always saved: a generated resume you cannot select again is of no
          // use in this flow.
          save_as: generateName.trim() || 'Generated from Vault',
        }),
      });

      await adopt(res, `Could not build a resume (server said ${res.status}).`);
    } catch (err) {
      console.error('Failed to generate a resume from the Vault:', err);
      setError('Could not reach the backend to build a resume.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (source: ResumeSource) => {
    setPendingDelete(null);

    try {
      const res = await fetch(`${API}/api/resume/sources/${source.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setError(`Could not delete that source (server said ${res.status}).`);
        return;
      }

      if (selectedId === source.id) onSelect(null);
      await loadSources();
    } catch (err) {
      console.error('Failed to delete resume source:', err);
      setError('Could not reach the backend to delete that source.');
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-ash-600 bg-ash-900 p-6 shadow-card">
      <div>
        <h2 className="font-display text-lg font-semibold text-ash-50">
          1. Choose a base resume
        </h2>
        <p className="mt-1 text-xs text-ash-200">
          Tailoring edits this document in place, so it has to be the real
          LaTeX source — not a PDF export.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-ash-600 bg-ash-800 p-1">
        {MODES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setError('');
            }}
            className={`relative flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              mode === key ? 'text-ash-950' : 'text-ash-200 hover:text-ash-50'
            }`}
          >
            {mode === key && (
              <motion.span
                layoutId="source-mode-pill"
                className="absolute inset-0 rounded-lg bg-ash-50"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          </button>
        ))}
      </div>

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

      {/* Saved sources */}
      {mode === 'stored' && (
        <div className="space-y-2">
          {loading && (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="shimmer h-14 rounded-xl" />
              ))}
            </div>
          )}

          {!loading && sources.length === 0 && (
            <p className="rounded-xl border border-dashed border-ash-500 px-4 py-8 text-center text-sm text-ash-200">
              No saved resumes yet. Upload a{' '}
              <code className="font-mono text-ash-100">.tex</code> file, paste
              your source, or build one from your Vault.
            </p>
          )}

          {sources.map((source) => {
            const active = source.id === selectedId;
            return (
              <motion.div
                key={source.id}
                layout
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  active
                    ? 'border-ash-400 bg-ash-700'
                    : 'border-ash-600 bg-ash-800 hover:border-ash-500'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : source)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      active
                        ? 'bg-ash-50 text-ash-950'
                        : 'bg-ash-700 text-ash-200'
                    }`}
                  >
                    {active ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <FileCode className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ash-50">
                      {source.name}
                    </span>
                    <span className="block text-[11px] text-ash-300">
                      Added {new Date(source.created_at).toLocaleDateString()}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPendingDelete(source)}
                  aria-label={`Delete ${source.name}`}
                  className="shrink-0 rounded-md p-1.5 text-ash-300 transition hover:bg-ash-600 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Upload */}
      {mode === 'upload' && (
        <div className="rounded-xl border-2 border-dashed border-ash-500 px-6 py-8 text-center">
          <input
            ref={fileInput}
            type="file"
            accept=".tex"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <p className="text-sm font-semibold text-ash-50">
            Upload your resume&rsquo;s{' '}
            <code className="font-mono">.tex</code> file
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ash-200">
            Stored byte-for-byte. Your preamble, custom macros, and layout are
            never rewritten — only the text inside your bullets changes.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold shadow-card transition-all duration-200 ${
              busy
                ? 'cursor-not-allowed bg-ash-700 text-ash-300'
                : 'bg-ash-50 text-ash-950 hover:-translate-y-0.5 hover:bg-white hover:shadow-lift'
            }`}
          >
            {busy ? 'Uploading...' : 'Choose a .tex file'}
          </button>
        </div>
      )}

      {/* Paste */}
      {mode === 'paste' && (
        <div className="space-y-3">
          <input
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
            placeholder="Name this resume (optional)"
            className={FIELD}
          />
          <textarea
            rows={10}
            value={pasteLatex}
            onChange={(e) => setPasteLatex(e.target.value)}
            placeholder={'\\documentclass{article}\n\\begin{document}\n...'}
            className={`${FIELD} resize-y font-mono text-xs`}
          />
          <button
            type="button"
            disabled={busy || !pasteLatex.trim()}
            onClick={handlePaste}
            className={`w-full rounded-lg py-2.5 text-sm font-semibold shadow-card transition-all duration-200 ${
              busy || !pasteLatex.trim()
                ? 'cursor-not-allowed bg-ash-700 text-ash-300'
                : 'bg-ash-50 text-ash-950 hover:-translate-y-0.5 hover:bg-white hover:shadow-lift'
            }`}
          >
            {busy ? 'Saving...' : 'Save as a source'}
          </button>
        </div>
      )}

      {/* Generate from Vault */}
      {mode === 'generate' && (
        <div className="space-y-3">
          <p className="rounded-lg border border-ash-600 bg-ash-800 px-4 py-3 text-xs leading-relaxed text-ash-200">
            Builds a plain, always-compilable{' '}
            <code className="font-mono text-ash-100">.tex</code> from every
            experience in your Master Vault. Your Vault stores experiences
            only, so the details below are the parts it cannot know.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="Full name"
              className={FIELD}
            />
            <input
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              placeholder="Email"
              className={FIELD}
            />
            <input
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="Phone"
              className={FIELD}
            />
            <input
              value={profile.location}
              onChange={(e) =>
                setProfile({ ...profile, location: e.target.value })
              }
              placeholder="Location"
              className={FIELD}
            />
          </div>

          <input
            value={profile.links}
            onChange={(e) => setProfile({ ...profile, links: e.target.value })}
            placeholder="Links, comma separated (github.com/you, linkedin.com/in/you)"
            className={FIELD}
          />
          <textarea
            rows={2}
            value={profile.education}
            onChange={(e) =>
              setProfile({ ...profile, education: e.target.value })
            }
            placeholder="Education — e.g. B.S. Computer Science, UC San Diego, 2026"
            className={`${FIELD} resize-y`}
          />
          <textarea
            rows={2}
            value={profile.skills}
            onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
            placeholder="Skills line — e.g. Python, TypeScript, FastAPI, React, PostgreSQL"
            className={`${FIELD} resize-y`}
          />
          <input
            value={generateName}
            onChange={(e) => setGenerateName(e.target.value)}
            placeholder="Save it as (optional)"
            className={FIELD}
          />

          <button
            type="button"
            disabled={busy}
            onClick={handleGenerate}
            className={`w-full rounded-lg py-2.5 text-sm font-semibold shadow-card transition-all duration-200 ${
              busy
                ? 'cursor-not-allowed bg-ash-700 text-ash-300'
                : 'bg-ash-50 text-ash-950 hover:-translate-y-0.5 hover:bg-white hover:shadow-lift'
            }`}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Building...
              </span>
            ) : (
              'Build a resume from my Vault'
            )}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this resume source?"
        body={`"${pendingDelete?.name ?? ''}" will be removed. Anything you already tailored from it stays on screen until you reload.`}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
