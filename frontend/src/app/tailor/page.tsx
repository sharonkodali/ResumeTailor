'use client';

import { useState } from 'react';

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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleTailor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;

    setLoading(true);
    setResult(null);

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
        console.error('Tailor API error:', await res.text());
      }
    } catch (error) {
      console.error('Failed to connect to AI tailor backend:', error);
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
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">✨ AI Resume Tailor</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste a target job posting below. GPT will match your master database against the role keywords and generate optimized bullet points.
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
            placeholder="Paste the full job description here (e.g., qualifications, key responsibilities, required skills)..."
            className="w-full p-4 border rounded-xl bg-white text-gray-900 shadow-2xs focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 text-white font-medium rounded-xl transition ${
            loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Analyzing & Rewriting with AI...' : '✨ Tailor My Resume'}
        </button>
      </form>

      {/* Results Section */}
      {result && (
        <div className="space-y-8 pt-4">
          {/* Analytics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Match Score Card */}
            <div className="bg-white p-6 border rounded-xl shadow-2xs flex flex-col justify-between">
              <span className="text-sm font-semibold text-gray-500">ATS Match Score</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-blue-600">
                  {result.match_score}%
                </span>
                <span className="text-xs text-gray-400">relevance match</span>
              </div>
            </div>

            {/* Extracted Keywords */}
            <div className="md:col-span-2 bg-white p-6 border rounded-xl shadow-2xs space-y-3">
              <span className="text-sm font-semibold text-gray-500">Extracted Job Keywords</span>
              <div className="flex flex-wrap gap-2">
                {result.extracted_keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md border"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Side-by-Side Tailored Bullets */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Tailored Bullet Points</h2>

            {result.tailored_bullets.map((item, index) => (
              <div key={index} className="bg-white border rounded-xl p-6 shadow-2xs space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Original Bullet */}
                  <div className="p-4 bg-slate-50 border rounded-lg space-y-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Original Bullet</span>
                    <p className="text-sm text-gray-700">{item.original_text}</p>
                  </div>

                  {/* Tailored Bullet */}
                  <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">AI Tailored Version</span>
                      <button
                        onClick={() => copyToClipboard(item.tailored_text, index)}
                        className="text-xs text-blue-600 font-semibold hover:underline"
                      >
                        {copiedIndex === index ? '✓ Copied!' : '📋 Copy'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-900 font-medium">{item.tailored_text}</p>
                  </div>
                </div>

                {/* Reasoning */}
                {item.reasoning && (
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    <span className="font-semibold text-gray-700">Optimization Note: </span>
                    {item.reasoning}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
