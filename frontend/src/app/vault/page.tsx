'use client';

import { useState } from 'react';

interface TailoredBullet {
  company: str;
  role: str;
  original_bullet: string;
  tailored_bullet: string;
  skills_highlighted: string[];
  impact_reasoning: string;
}

interface TailorResponse {
  match_score: number;
  extracted_keywords: string[];
  tailored_bullets: TailoredBullet[];
}

export default function TailorPage() {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleTailor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('http://localhost:8000/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to tailor resume.');
      }

      const data: TailorResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while calling the AI service.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">AI Resume Tailor</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste a target job description below to generate ATS-optimized bullet points from your Master Vault.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleTailor} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Target Job Description
          </label>
          <textarea
            rows={8}
            required
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the target job description or key requirements here (e.g., 'Looking for a Machine Learning Engineer with Python, PyTorch, and FastAPI experience...')"
            className="w-full p-4 border rounded-xl bg-white text-gray-900 shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !jobDescription.trim()}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-xs"
        >
          {loading ? 'Analyzing Job Description & Tailoring Bullets...' : '✨ Generate Tailored Resume Bullets'}
        </button>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-8 mt-8 border-t pt-8">
          {/* Top Stat Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Match Score Card */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl flex flex-col justify-between shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Estimated ATS Match Score
              </span>
              <div className="flex items-baseline gap-2 my-2">
                <span className="text-5xl font-extrabold text-blue-400">{result.match_score}%</span>
                <span className="text-xs text-slate-400">relevance match</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${result.match_score}%` }}
                />
              </div>
            </div>

            {/* Extracted Keywords */}
            <div className="md:col-span-2 border bg-white p-6 rounded-2xl shadow-xs space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Extracted Job Keywords
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {result.extracted_keywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Bullet Point Comparisons */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Tailored Resume Bullet Points</h2>

            {result.tailored_bullets.map((item, index) => (
              <div key={index} className="border rounded-xl bg-white p-6 shadow-xs space-y-4">
                <div className="flex justify-between items-start border-b pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{item.role}</h3>
                    <p className="text-xs font-medium text-gray-500">{item.company}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.tailored_bullet, index)}
                    className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
                  >
                    {copiedIndex === index ? '✓ Copied!' : '📋 Copy Bullet'}
                  </button>
                </div>

                {/* Before / After View */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* Original Bullet */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Original Vault Bullet
                    </span>
                    <p className="text-gray-600">{item.original_bullet}</p>
                  </div>

                  {/* Tailored Bullet */}
                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200">
                    <span className="block text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                      ✨ AI Tailored Version
                    </span>
                    <p className="text-gray-900 font-medium">{item.tailored_bullet}</p>
                  </div>
                </div>

                {/* Skills & AI Reasoning */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-gray-500">Highlighted Skills:</span>
                    {item.skills_highlighted.map((skill, sIdx) => (
                      <span key={sIdx} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-500 italic">💡 {item.impact_reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
