'use client';

import { useMemo, useState } from 'react';

import { collapseUnchanged, diffLines } from '@/lib/diff';

/*
 * Sides are coloured by origin rather than by the usual red/green: the left is
 * what came out of the Vault (brown), the right is what the tailor produced
 * (blue). Nothing here is an error, so red/green would read wrong.
 */
const ROW_STYLES: Record<string, { left: string; right: string }> = {
  same: { left: 'text-stone-500', right: 'text-stone-500' },
  changed: {
    left: 'bg-brown-50 text-brown-900',
    right: 'bg-blue-50 text-blue-900',
  },
  removed: { left: 'bg-brown-50 text-brown-900', right: 'bg-stone-50' },
  added: { left: 'bg-stone-50', right: 'bg-blue-50 text-blue-900' },
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
    <div className="overflow-hidden rounded-xl border border-brown-200/70 bg-white shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-brown-100 bg-brown-50/70 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-brown-800">Original</span>
          <span className="font-semibold text-blue-700">Tailored</span>
          <span className="text-stone-400">
            {changeCount} changed line{changeCount === 1 ? '' : 's'}
          </span>
        </div>
        <button
          onClick={() => setShowAll(!showAll)}
          className="font-semibold text-blue-700 transition hover:text-blue-900 hover:underline"
        >
          {showAll ? 'Collapse unchanged' : 'Show whole file'}
        </button>
      </div>

      {/* The document decides the width here, so the diff scrolls rather than
          wrapping LaTeX mid-command. */}
      <div className="scroll-warm max-h-[32rem] overflow-x-auto overflow-y-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {visible.map((row, i) => {
              if (row.kind === 'skipped') {
                return (
                  <tr key={`skip-${i}`} className="bg-brown-50/60">
                    <td colSpan={4} className="px-4 py-1 text-center text-[11px] text-stone-400">
                      {row.count} unchanged line{row.count === 1 ? '' : 's'}
                    </td>
                  </tr>
                );
              }

              const style = ROW_STYLES[row.kind];
              return (
                <tr key={i} className="align-top">
                  <td className="w-10 select-none border-r border-brown-100 px-2 text-right text-[10px] text-stone-300">
                    {row.leftNumber ?? ''}
                  </td>
                  <td className={`px-3 py-0.5 whitespace-pre w-1/2 ${style.left}`}>
                    {row.left ?? ''}
                  </td>
                  <td className="w-10 select-none border-x border-brown-100 px-2 text-right text-[10px] text-stone-300">
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
