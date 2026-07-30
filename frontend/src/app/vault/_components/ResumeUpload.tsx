'use client';

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

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
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
        className={`border-2 border-dashed rounded-xl px-6 py-8 text-center transition ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-slate-50'
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

        <p className="text-sm font-medium text-gray-700">
          {parsing ? 'Reading your resume...' : 'Import from an existing resume'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Drop a PDF, .docx, or LaTeX (.tex) file here — or
        </p>
        <button
          type="button"
          disabled={parsing}
          onClick={() => fileInput.current?.click()}
          className={`mt-3 px-4 py-2 text-sm font-medium rounded-lg transition ${
            parsing
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-gray-700'
          }`}
        >
          {parsing ? 'Parsing...' : 'Choose a file'}
        </button>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Review panel — nothing is saved until the user confirms */}
      {drafts && (
        <div className="border rounded-xl bg-white p-6 space-y-5 shadow-2xs">
          <div className="flex justify-between items-start gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Review what we found in {filename}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {drafts.length} experience{drafts.length === 1 ? '' : 's'} detected.
                Uncheck anything you do not want, then import. Nothing is saved until you do.
              </p>
            </div>
            <button
              type="button"
              onClick={discard}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800 shrink-0"
            >
              Discard
            </button>
          </div>

          {!aiStructured && (
            <div className="border border-amber-200 bg-amber-50 text-amber-800 text-xs px-4 py-3 rounded-lg">
              The AI structuring step was unavailable, so this resume was split up
              heuristically. Check the company, role, and dates on each entry before importing.
            </div>
          )}

          {drafts.map((draft, i) => (
            <div
              key={i}
              className={`border rounded-lg p-4 space-y-3 transition ${
                draft.selected ? 'bg-white' : 'bg-slate-50 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft.selected}
                  onChange={() => updateDraft(i, { selected: !draft.selected })}
                  className="mt-2.5 h-4 w-4 shrink-0"
                />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 flex-1">
                  <input
                    value={draft.company}
                    onChange={(e) => updateDraft(i, { company: e.target.value })}
                    placeholder="Company"
                    className="p-2 border rounded-md text-sm font-semibold text-gray-900 md:col-span-1"
                  />
                  <input
                    value={draft.role}
                    onChange={(e) => updateDraft(i, { role: e.target.value })}
                    placeholder="Role"
                    className="p-2 border rounded-md text-sm text-gray-900"
                  />
                  <input
                    value={draft.dates}
                    onChange={(e) => updateDraft(i, { dates: e.target.value })}
                    placeholder="Dates"
                    className="p-2 border rounded-md text-sm text-gray-700"
                  />
                  <select
                    value={draft.category}
                    onChange={(e) => updateDraft(i, { category: e.target.value })}
                    className="p-2 border rounded-md text-sm bg-white text-gray-900"
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
                      className="mt-1 h-3.5 w-3.5 shrink-0"
                    />
                    <div className="flex-1">
                      <p
                        className={`text-sm ${
                          bullet.selected ? 'text-gray-800' : 'text-gray-400 line-through'
                        }`}
                      >
                        {bullet.text}
                      </p>
                      {bullet.skills && (
                        <div className="mt-1 flex gap-1 flex-wrap">
                          {bullet.skills.split(',').map((skill, k) => (
                            <span
                              key={k}
                              className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded"
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
                  <li className="text-xs text-gray-400 italic">
                    No bullet points found for this entry — you can add them after importing.
                  </li>
                )}
              </ul>
            </div>
          ))}

          <button
            type="button"
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
            className={`w-full py-2.5 font-medium rounded-lg transition ${
              importing || selectedCount === 0
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {importing
              ? 'Importing...'
              : `Import ${selectedCount} experience${selectedCount === 1 ? '' : 's'} to Vault`}
          </button>
        </div>
      )}
    </div>
  );
}
