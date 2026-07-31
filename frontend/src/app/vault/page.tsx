'use client';
import { ExperienceCard } from '@/components/ExperienceCard';
import { Plus, Database, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';

import ResumeUpload from './_components/ResumeUpload';

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

export default function VaultPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState('');

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
    fetch('http://localhost:8000/api/experiences')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: Experience[]) => setExperiences(data))
      .catch((err) => console.error('Failed to load experiences:', err))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchExperiences();
  }, []);

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

  const handleDelete = async (exp: Experience) => {
    if (exp.id === undefined) return;
    const confirmed = window.confirm(
      `Delete "${exp.role} at ${exp.company}" and its ${exp.bullets.length} bullet point(s)? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`http://localhost:8000/api/experiences/${exp.id}`, {
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
      ? `http://localhost:8000/api/experiences/${editingId}`
      : 'http://localhost:8000/api/experiences';

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
        setError(
          `Could not save that experience (server said ${res.status}).`
        );
      }
    } catch (err) {
      console.error('Failed to save experience:', err);
      setError('Could not reach the backend to save that experience.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
            <Database className="w-7 h-7 text-blue-600" />
            Master Experience Vault
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Store and manage all your raw roles, projects, and bullet points in one central database.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            {showUpload ? 'Hide Upload' : 'Upload Resume'}
          </button>
          <button
            onClick={() => (showForm ? closeForm() : setShowForm(true))}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Add Experience'}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Bulk import from an existing resume file */}
      {showUpload && (
        <ResumeUpload
          onImported={() => {
            setShowUpload(false);
            fetchExperiences();
          }}
        />
      )}

      {/* Add / Edit Experience Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 border p-6 rounded-xl space-y-6 shadow-xs">
          <h2 className="text-xl font-semibold text-gray-800">
            {editingId ? 'Edit Experience Entry' : 'New Experience Entry'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company / Organization</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g., Sprout Media or Open Coding Society"
                className="mt-1 w-full p-2 border rounded-md bg-white text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role / Title</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Lead Research Intern or Full-Stack Developer"
                className="mt-1 w-full p-2 border rounded-md bg-white text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Dates</label>
              <input
                type="text"
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                placeholder="e.g., Jun 2026 - Present"
                className="mt-1 w-full p-2 border rounded-md bg-white text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full p-2 border rounded-md bg-white text-gray-900"
              >
                <option value="Work">Work Experience</option>
                <option value="Project">Project</option>
                <option value="Research">Research</option>
                <option value="Leadership">Leadership</option>
              </select>
            </div>
          </div>

          {/* Dynamic Bullets Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-semibold text-gray-800">Bullet Points</label>
              <button
                type="button"
                onClick={addBulletField}
                className="text-xs text-blue-600 font-semibold hover:underline"
              >
                + Add Another Bullet
              </button>
            </div>

            {bullets.map((bullet, index) => (
              <div key={index} className="flex gap-2 items-start bg-white p-3 border rounded-md shadow-2xs">
                <div className="flex-1 space-y-2">
                  <textarea
                    rows={2}
                    placeholder={`Bullet #${index + 1}: e.g., Engineered real-time data processing pipeline...`}
                    value={bullet.text}
                    onChange={(e) => handleBulletChange(index, 'text', e.target.value)}
                    className="w-full p-2 border rounded-md text-sm text-gray-900"
                  />
                  <input
                    type="text"
                    placeholder="Skills used (comma-separated): e.g., Python, PyTorch, FastAPI"
                    value={bullet.skills}
                    onChange={(e) => handleBulletChange(index, 'skills', e.target.value)}
                    className="w-full p-1.5 border rounded-md text-xs text-gray-700"
                  />
                </div>
                {bullets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBulletField(index)}
                    className="text-red-500 hover:text-red-700 text-sm p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
            >
              {editingId ? 'Update Experience' : 'Save Experience to Vault'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={closeForm}
                className="px-6 py-2.5 border border-gray-300 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {/* Experience Display List */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-slate-500 text-sm">Loading Master Vault...</p>
        ) : experiences.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
            <p className="text-slate-700 font-medium">Your Master Vault is empty.</p>
            <p className="text-xs text-slate-400">
              Click &quot;+ Add Experience&quot; above to store your first entry, or{' '}
              <button
                onClick={() => setShowUpload(true)}
                className="text-blue-600 font-semibold hover:underline"
              >
                upload an existing resume
              </button>{' '}
              to fill it in one go.
            </p>
          </div>
        ) : (
          experiences.map((exp, index) => (
            <ExperienceCard
              key={exp.id || index}
              experience={exp}
              index={index}
              isEditing={editingId === exp.id}
              onEdit={() => startEdit(exp)}
              onDelete={() => handleDelete(exp)}
            />
          ))
        )}
      </div>
    </div>
  );
}