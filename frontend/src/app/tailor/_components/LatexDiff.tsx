'use client';

import { useMemo, useState } from 'react';

import { collapseUnchanged, diffLines } from '@/lib/diff';

const ROW_STYLES: Record<string, { left: string; right: string }> = {
  same: { left: 'text-slate-500', right: 'text-slate-500' },
  changed: { left: 'bg-red-50 text-red-900', right: 'bg-green-50 text-green-900' },
  removed: { left: 'bg-red-50 text-red-900', right: 'bg-slate-50' },
  added: { left: 'bg-slate-50', right: 'bg-green-50 text-green-900' },
};

export default function LatexDiff({
  original,
  tailored,
}: {
  original: string;
  tailored: string;
}) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => diffLines(original, tailored), [original, tailored]);
  const visible = useMemo(
    () => (showAll ? rows : collapseUnchanged(rows)),
    [rows, showAll]
  );

  const changeCount = rows.filter((r) => r.kind !== 'same').length;

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b bg-slate-50 text-xs">
        <div className="flex gap-4">
          <span className="font-semibold text-slate-700">Original</span>
          <span className="text-slate-400">
            {changeCount} changed line{changeCount === 1 ? '' : 's'}
          </span>
        </div>
        <button
          onClick={() => setShowAll(!showAll)}
          className="font-semibold text-blue-600 hover:underline"
        >
          {showAll ? 'Collapse unchanged' : 'Show whole file'}
        </button>
      </div>

      {/* The document decides the width here, so the diff scrolls rather than
          wrapping LaTeX mid-command. */}
      <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {visible.map((row, i) => {
              if (row.kind === 'skipped') {
                return (
                  <tr key={`skip-${i}`} className="bg-slate-50/70">
                    <td colSpan={4} className="px-4 py-1 text-center text-[11px] text-slate-400">
                      {row.count} unchanged line{row.count === 1 ? '' : 's'}
                    </td>
                  </tr>
                );
              }

              const style = ROW_STYLES[row.kind];
              return (
                <tr key={i} className="align-top">
                  <td className="select-none w-10 px-2 text-right text-[10px] text-slate-300 border-r">
                    {row.leftNumber ?? ''}
                  </td>
                  <td className={`px-3 py-0.5 whitespace-pre w-1/2 ${style.left}`}>
                    {row.left ?? ''}
                  </td>
                  <td className="select-none w-10 px-2 text-right text-[10px] text-slate-300 border-l border-r">
                    {row.rightNumber ?? ''}
                  </td>
                  <td className={`px-3 py-0.5 whitespace-pre w-1/2 ${style.right}`}>
                    {row.right ?? ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
