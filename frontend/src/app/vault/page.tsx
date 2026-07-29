'use client';

import { useState, useEffect } from 'react';

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

  // Form State
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [dates, setDates] = useState('');
  const [category, setCategory] = useState('Work');
  const [bullets, setBullets] = useState<BulletPoint[]>([{ text: '', skills: '' }]);

  const fetchExperiences = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/experiences');
      if (res.ok) {
        const data = await res.json();
        setExperiences(data);
      }
    } catch (error) {
      console.error('Failed to load experiences:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiences();
  }, []);

  const handleBulletChange = (index: number, field: 'text' | 'skills', value: string) => {
    const updatedBullets = [...bullets];
    updatedBullets[index][field] = value;
    setBullets(updatedBullets);
  };

  const addBulletField = () => {
    setBullets([...bullets, { text: '', skills: '' }]);
  };

  const removeBulletField = (index: number) => {
    setBullets(bullets.filter((_, i) => i !== index));
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

    try {
      const res = await fetch('http://localhost:8000/api/experiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCompany('');
        setRole('');
        setDates('');
        setCategory('Work');
        setBullets([{ text: '', skills: '' }]);
        setShowForm(false);
        fetchExperiences();
      }
    } catch (error) {
      console.error('Failed to save experience:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Master Experience Vault</h1>
          <p className="text-sm text-gray-500 mt-1">
            Store and manage all your raw roles, projects, and bullet points in one central database.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
        >
          {showForm ? 'Cancel' : '+ Add Experience'}
        </button>
      </div>

      {/* Add Experience Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 border p-6 rounded-xl space-y-6 shadow-xs">
          <h2 className="text-xl font-semibold text-gray-800">New Experience Entry</h2>
          
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

          <button
            type="submit"
            className="w-full py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
          >
            Save Experience to Vault
          </button>
        </form>
      )}

      {/* Experience Display List */}
      <div className="space-y-6">
        {loading ? (
          <p className="text-gray-500">Loading Master Vault...</p>
        ) : experiences.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50">
            <p className="text-gray-600 font-medium">Your Master Vault is empty.</p>
            <p className="text-xs text-gray-400 mt-1">Click "+ Add Experience" above to store your first entry.</p>
          </div>
        ) : (
          experiences.map((exp) => (
            <div key={exp.id} className="border rounded-xl p-6 bg-white shadow-2xs space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900">{exp.role}</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                      {exp.category}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-600 mt-0.5">{exp.company}</p>
                </div>
                <span className="text-xs font-mono text-gray-400">{exp.dates}</span>
              </div>

              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-800">
                {exp.bullets.map((b) => (
                  <li key={b.id}>
                    <span>{b.text}</span>
                    {b.skills && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {b.skills.split(',').map((skill, idx) => (
                          <span key={idx} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                            {skill.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}