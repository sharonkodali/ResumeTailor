'use client';

import { useMemo, useState } from 'react';

import { collapseUnchanged, diffLines } from '@/lib/diff';

/*
 * Sides are distinguished by weight rather than by the usual red/green: the
 * left is what came out of the Vault (sunken, dimmer), the right is what the
 * tailor produced (raised, full white). Nothing here is an error, so red/green
 * would read wrong. An empty half is left unfilled so it is obvious at a
 * glance which side actually has a line on it.
 */
const ROW_STYLES: Record<string, { left: string; right: string }> = {
  same: { left: 'text-ash-300', right: 'text-ash-300' },
  changed: {
    left: 'bg-ash-800 text-ash-100',
    right: 'bg-ash-700 text-ash-50',
  },
  removed: { left: 'bg-ash-800 text-ash-100', right: '' },
  added: { left: '', right: 'bg-ash-700 text-ash-50' },
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
    <div className="overflow-hidden rounded-xl border border-ash-600 bg-ash-900 shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-ash-600 bg-ash-800 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-ash-100">Original</span>
          <span className="font-semibold text-ash-50">Tailored</span>
          <span className="text-ash-300">
            {changeCount} changed line{changeCount === 1 ? '' : 's'}
          </span>
        </div>
        <button
          onClick={() => setShowAll(!showAll)}
          className="font-semibold text-ash-100 transition hover:text-ash-50 hover:underline"
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
                  <tr key={`skip-${i}`} className="bg-ash-800">
                    <td colSpan={4} className="px-4 py-1 text-center text-[11px] text-ash-300">
                      {row.count} unchanged line{row.count === 1 ? '' : 's'}
                    </td>
                  </tr>
                );
              }

              const style = ROW_STYLES[row.kind];
              return (
                <tr key={i} className="align-top">
                  <td className="w-10 select-none border-r border-ash-600 px-2 text-right text-[10px] text-ash-300">
                    {row.leftNumber ?? ''}
                  </td>
                  <td className={`px-3 py-0.5 whitespace-pre w-1/2 ${style.left}`}>
                    {row.left ?? ''}
                  </td>
                  <td className="w-10 select-none border-x border-ash-600 px-2 text-right text-[10px] text-ash-300">
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
