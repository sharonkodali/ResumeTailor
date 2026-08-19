'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Database, Plus, Search, Sparkles, X } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

import { ExperienceCard } from '@/components/ExperienceCard';
import ConfirmDialog from '../_components/ConfirmDialog';
import ResumeUpload from './_components/ResumeUpload';
import { API } from '@/lib/api';

interface BulletPoint {
  id?: number;
  text: string;
  skills: string;
}

interface Experience {
  id?: number;
  company: string;
  role: string;
  dates: string;
  category: string;
  bullets: BulletPoint[];
}

const CATEGORIES = ['Work', 'Project', 'Research', 'Leadership'] as const;

export default function VaultPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState('');

  // Browsing state
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [pendingDelete, setPendingDelete] = useState<Experience | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [dates, setDates] = useState('');
  const [category, setCategory] = useState('Work');
  const [bullets, setBullets] = useState<BulletPoint[]>([{ text: '', skills: '' }]);

  // Promise callbacks rather than await: state must not be set synchronously
  // inside the mount effect below (react-hooks/set-state-in-effect).
  const fetchExperiences = () =>
    fetch(`${API}/api/experiences`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: Experience[]) => setExperiences(data))
      .catch((err) => console.error('Failed to load experiences:', err))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchExperiences();
  }, []);

  const bulletCount = useMemo(
    () => experiences.reduce((sum, exp) => sum + exp.bullets.length, 0),
    [experiences]
  );

  const skillCount = useMemo(() => {
    const skills = new Set<string>();
    experiences.forEach((exp) =>
      exp.bullets.forEach((b) =>
        b.skills
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
          .forEach((s) => skills.add(s))
      )
    );
    return skills.size;
  }, [experiences]);

  // Search covers everything a user might remember an entry by — including the
  // bullet and skill text, not just the job title.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return experiences.filter((exp) => {
      if (activeCategory !== 'All' && exp.category !== activeCategory) return false;
      if (!q) return true;
      const haystack = [
        exp.company,
        exp.role,
        exp.dates,
        exp.category,
        ...exp.bullets.map((b) => `${b.text} ${b.skills}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [experiences, query, activeCategory]);

  const handleBulletChange = (index: number, field: 'text' | 'skills', value: string) => {
    setBullets(bullets.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  const addBulletField = () => {
    setBullets([...bullets, { text: '', skills: '' }]);
  };

  const removeBulletField = (index: number) => {
    setBullets(bullets.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setEditingId(null);
    setCompany('');
    setRole('');
    setDates('');
    setCategory('Work');
    setBullets([{ text: '', skills: '' }]);
  };

  const closeForm = () => {
    resetForm();
    setShowForm(false);
    setError('');
  };

  const startEdit = (exp: Experience) => {
    setEditingId(exp.id ?? null);
    setCompany(exp.company);
    setRole(exp.role);
    setDates(exp.dates);
    setCategory(exp.category);
    // The form always needs at least one bullet row to render.
    setBullets(
      exp.bullets.length > 0
        ? exp.bullets.map((b) => ({ text: b.text, skills: b.skills }))
        : [{ text: '', skills: '' }]
    );
    setShowForm(true);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    const exp = pendingDelete;
    setPendingDelete(null);
    if (!exp || exp.id === undefined) return;

    try {
      const res = await fetch(`${API}/api/experiences/${exp.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // If the entry being edited is the one deleted, drop the stale form.
        if (editingId === exp.id) closeForm();
        setError('');
        fetchExperiences();
      } else {
        setError(`Could not delete that experience (server said ${res.status}).`);
      }
    } catch (err) {
      console.error('Failed to delete experience:', err);
      setError('Could not reach the backend to delete that experience.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Experience = {
      company,
      role,
      dates,
      category,
      bullets: bullets.filter((b) => b.text.trim() !== ''),
    };

    const url = editingId
      ? `${API}/api/experiences/${editingId}`
      : `${API}/api/experiences`;

    try {
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        closeForm();
        fetchExperiences();
      } else {
        setError(`Could not save that experience (server said ${res.status}).`);
      }
    } catch (err) {
      console.error('Failed to save experience:', err);
      setError('Could not reach the backend to save that experience.');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-ash-500 bg-ash-700 px-3 py-2 text-sm text-ash-50 transition placeholder:text-ash-300 focus:border-ash-300 focus:outline-none focus:ring-2 focus:ring-ash-500';

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-ash-600 pb-6 md:flex-row md:items-end">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-3xl font-semibold text-ash-50">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ash-50 text-ash-950">
              <Database className="h-5 w-5" />
            </span>
            Master Experience Vault
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ash-100">
            Store and manage all your raw roles, projects, and bullet points in
            one central database.
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ash-600 bg-ash-900 px-4 py-2 text-sm font-semibold text-ash-100 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-ash-400 hover:text-ash-50 hover:shadow-lift"
          >
            <Sparkles className="h-4 w-4 text-ash-50" />
            {showUpload ? 'Hide Upload' : 'Upload Resume'}
          </button>
          <button
            onClick={() => (showForm ? closeForm() : setShowForm(true))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ash-50 px-4 py-2 text-sm font-semibold text-ash-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lift"
          >
            <motion.span
              animate={{ rotate: showForm ? 45 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Plus className="h-4 w-4" />
            </motion.span>
            {showForm ? 'Cancel' : 'Add Experience'}
          </button>
        </div>
      </div>

      {/* Vault stats */}
      {!loading && experiences.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Experiences', value: experiences.length, lead: false },
            { label: 'Bullet points', value: bulletCount, lead: false },
            // The derived figure is the interesting one, so it gets the
            // raised surface rather than a colour of its own.
            { label: 'Distinct skills', value: skillCount, lead: true },
          ].map(({ label, value, lead }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className={`rounded-xl border p-4 ${
                lead
                  ? 'border-ash-500 bg-ash-700'
                  : 'border-ash-600 bg-ash-900'
              }`}
            >
              <div
                className={`text-2xl font-semibold ${
                  lead ? 'text-ash-50' : 'text-ash-100'
                }`}
              >
                {value}
              </div>
              <div className="mt-0.5 text-xs font-medium text-ash-200">
                {label}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              <span>{error}</span>
              <button
                onClick={() => setError('')}
                aria-label="Dismiss error"
                className="shrink-0 text-rose-400/70 transition hover:text-rose-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk import from an existing resume file */}
      <AnimatePresence initial={false}>
        {showUpload && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ResumeUpload
              onImported={() => {
                setShowUpload(false);
                fetchExperiences();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Experience Form */}
      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-6 rounded-2xl border border-ash-600 bg-ash-900 p-6">
              <h2 className="font-display text-xl font-semibold text-ash-50">
                {editingId ? 'Edit Experience Entry' : 'New Experience Entry'}
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ash-100">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g., Sprout Media or Open Coding Society"
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ash-100">
                    Role / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g., Lead Research Intern or Full-Stack Developer"
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ash-100">
                    Dates
                  </label>
                  <input
                    type="text"
                    value={dates}
                    onChange={(e) => setDates(e.target.value)}
                    placeholder="e.g., Jun 2026 - Present"
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ash-100">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`mt-1.5 ${inputClass}`}
                  >
                    <option value="Work">Work Experience</option>
                    <option value="Project">Project</option>
                    <option value="Research">Research</option>
                    <option value="Leadership">Leadership</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Bullets Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-ash-50">
                    Bullet Points
                  </label>
                  <button
                    type="button"
                    onClick={addBulletField}
                    className="text-xs font-semibold text-ash-50 transition hover:text-ash-50 hover:underline"
                  >
                    + Add Another Bullet
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {bullets.map((bullet, index) => (
                    <motion.div
                      key={index}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-2 rounded-lg border border-ash-600 bg-ash-800 p-3"
                    >
                      <span className="mt-2 select-none font-mono text-xs text-ash-300">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        <textarea
                          rows={2}
                          placeholder={`Bullet #${index + 1}: e.g., Engineered real-time data processing pipeline...`}
                          value={bullet.text}
                          onChange={(e) =>
                            handleBulletChange(index, 'text', e.target.value)
                          }
                          className={inputClass}
                        />
                        <input
                          type="text"
                          placeholder="Skills used (comma-separated): e.g., Python, PyTorch, FastAPI"
                          value={bullet.skills}
                          onChange={(e) =>
                            handleBulletChange(index, 'skills', e.target.value)
                          }
                          className={`${inputClass} py-1.5 text-xs`}
                        />
                      </div>
                      {bullets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBulletField(index)}
                          aria-label={`Remove bullet ${index + 1}`}
                          className="rounded-md p-1.5 text-ash-300 transition hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-ash-50 py-2.5 text-sm font-semibold text-ash-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lift"
                >
                  {editingId ? 'Update Experience' : 'Save Experience to Vault'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg border border-ash-500 bg-ash-700 px-6 py-2.5 text-sm font-semibold text-ash-50 transition hover:bg-ash-600"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Search + category filter */}
      {!loading && experiences.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash-300" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roles, bullets, skills..."
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {['All', ...CATEGORIES].map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`relative rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active ? 'text-ash-950' : 'text-ash-200 hover:text-ash-50'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="category-pill"
                      className="absolute inset-0 rounded-full bg-ash-50"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Experience Display List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer h-36 rounded-2xl" />
            ))}
          </div>
        ) : experiences.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 rounded-2xl border-2 border-dashed border-ash-600 bg-ash-800 py-16 text-center"
          >
            <p className="font-display text-lg font-semibold text-ash-50">
              Your Master Vault is empty.
            </p>
            <p className="text-sm text-ash-200">
              Click &quot;Add Experience&quot; above to store your first entry, or{' '}
              <button
                onClick={() => setShowUpload(true)}
                className="font-semibold text-ash-50 underline-offset-2 hover:underline"
              >
                upload an existing resume
              </button>{' '}
              to fill it in one go.
            </p>
          </motion.div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-ash-600 bg-ash-900 py-14 text-center">
            <p className="text-sm text-ash-100">
              Nothing in the Vault matches that filter.
            </p>
            <button
              onClick={() => {
                setQuery('');
                setActiveCategory('All');
              }}
              className="mt-2 text-sm font-semibold text-ash-50 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {visible.map((exp, index) => (
              <ExperienceCard
                key={exp.id ?? index}
                experience={exp}
                index={index}
                isEditing={editingId === exp.id}
                onEdit={() => startEdit(exp)}
                onDelete={() => setPendingDelete(exp)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this experience?"
        body={
          pendingDelete
            ? `"${pendingDelete.role} at ${pendingDelete.company}" and its ${pendingDelete.bullets.length} bullet point(s) will be removed. This cannot be undone.`
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
