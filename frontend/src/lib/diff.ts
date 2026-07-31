/**
 * Line-level diff for showing what tailoring changed in a .tex file.
 *
 * Hand-rolled rather than pulled from npm: a resume is a few hundred lines, so
 * the quadratic LCS table is trivially fast, and the output shape is built for
 * the side-by-side view rather than adapted to it.
 */

export type RowKind = 'same' | 'changed' | 'added' | 'removed';

export interface DiffRow {
  kind: RowKind;
  left?: string;
  right?: string;
  /** 1-based line numbers in each document; absent where the side is empty. */
  leftNumber?: number;
  rightNumber?: number;
}

type Op = { kind: 'equal' | 'remove' | 'add'; text: string };

/** Longest-common-subsequence lengths for every prefix pair. */
function lcsTable(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  return table;
}

function toOps(a: string[], b: string[]): Op[] {
  const table = lcsTable(a, b);
  const ops: Op[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'equal', text: a[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ kind: 'remove', text: a[i] });
      i++;
    } else {
      ops.push({ kind: 'add', text: b[j] });
      j++;
    }
  }

  while (i < a.length) ops.push({ kind: 'remove', text: a[i++] });
  while (j < b.length) ops.push({ kind: 'add', text: b[j++] });

  return ops;
}

/**
 * Align two documents into rows for a side-by-side view.
 *
 * A removal immediately followed by an addition is paired into one `changed`
 * row, which is what a rewritten bullet looks like and reads far better than
 * two separate rows sitting on opposite sides.
 */
export function diffLines(original: string, tailored: string): DiffRow[] {
  const ops = toOps(original.split('\n'), tailored.split('\n'));
  const rows: DiffRow[] = [];

  let leftNumber = 0;
  let rightNumber = 0;
  let index = 0;

  while (index < ops.length) {
    const op = ops[index];

    if (op.kind === 'equal') {
      rows.push({
        kind: 'same',
        left: op.text,
        right: op.text,
        leftNumber: ++leftNumber,
        rightNumber: ++rightNumber,
      });
      index++;
      continue;
    }

    // Gather the full run of removals then additions at this position.
    const removed: string[] = [];
    const added: string[] = [];
    while (index < ops.length && ops[index].kind === 'remove') {
      removed.push(ops[index++].text);
    }
    while (index < ops.length && ops[index].kind === 'add') {
      added.push(ops[index++].text);
    }

    for (let k = 0; k < Math.max(removed.length, added.length); k++) {
      const left = removed[k];
      const right = added[k];

      if (left !== undefined && right !== undefined) {
        rows.push({
          kind: 'changed',
          left,
          right,
          leftNumber: ++leftNumber,
          rightNumber: ++rightNumber,
        });
      } else if (left !== undefined) {
        rows.push({ kind: 'removed', left, leftNumber: ++leftNumber });
      } else {
        rows.push({ kind: 'added', right, rightNumber: ++rightNumber });
      }
    }
  }

  return rows;
}

/** Collapse long runs of unchanged lines, keeping `context` rows either side. */
export function collapseUnchanged(
  rows: DiffRow[],
  context = 3
): (DiffRow | { kind: 'skipped'; count: number })[] {
  const keep = new Set<number>();

  rows.forEach((row, i) => {
    if (row.kind === 'same') return;
    for (let j = i - context; j <= i + context; j++) {
      if (j >= 0 && j < rows.length) keep.add(j);
    }
  });

  const out: (DiffRow | { kind: 'skipped'; count: number })[] = [];
  let skipped = 0;

  rows.forEach((row, i) => {
    if (keep.has(i)) {
      if (skipped > 0) {
        out.push({ kind: 'skipped', count: skipped });
        skipped = 0;
      }
      out.push(row);
    } else {
      skipped++;
    }
  });

  if (skipped > 0) out.push({ kind: 'skipped', count: skipped });

  return out;
}
