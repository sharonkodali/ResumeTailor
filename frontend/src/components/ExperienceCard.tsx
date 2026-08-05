'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  Calendar,
  ChevronDown,
  Pencil,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

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

interface ExperienceCardProps {
  experience: Experience;
  index: number;
  /** Highlights the card whose entry is loaded into the edit form. */
  isEditing?: boolean;
  /** Omit both handlers to render the card read-only. */
  onEdit?: () => void;
  onDelete?: () => void;
}

/*
 * Each category gets its own tone so the list is scannable by shape alone.
 * With no hues left to spend, the rail carries the distinction as a step on
 * the grey ramp — four values far enough apart to tell apart at 4px wide.
 */
const CATEGORY_TONES: Record<string, { chip: string; rail: string; dot: string }> = {
  Work: {
    chip: 'bg-ash-600 text-ash-50 ring-ash-500',
    rail: 'bg-ash-50',
    dot: 'text-ash-50',
  },
  Project: {
    chip: 'bg-ash-700 text-ash-100 ring-ash-500',
    rail: 'bg-ash-100',
    dot: 'text-ash-100',
  },
  Research: {
    chip: 'bg-ash-700 text-ash-200 ring-ash-600',
    rail: 'bg-ash-200',
    dot: 'text-ash-200',
  },
  Leadership: {
    chip: 'bg-ash-800 text-ash-200 ring-ash-600',
    rail: 'bg-ash-300',
    dot: 'text-ash-300',
  },
};

const FALLBACK_TONE = {
  chip: 'bg-ash-800 text-ash-300 ring-ash-600',
  rail: 'bg-ash-500',
  dot: 'text-ash-300',
};

/** Cards start collapsed past this many bullets to keep the list skimmable. */
const COLLAPSE_AFTER = 3;

export function ExperienceCard({
  experience,
  index,
  isEditing = false,
  onEdit,
  onDelete,
}: ExperienceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const tone = CATEGORY_TONES[experience.category] ?? FALLBACK_TONE;
  const collapsible = experience.bullets.length > COLLAPSE_AFTER;
  const visibleBullets =
    collapsible && !expanded
      ? experience.bullets.slice(0, COLLAPSE_AFTER)
      : experience.bullets;
  const hiddenCount = experience.bullets.length - COLLAPSE_AFTER;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className={`group relative overflow-hidden rounded-2xl border bg-ash-900 p-6 pl-7 shadow-card transition-shadow duration-200 hover:shadow-lift ${
        isEditing ? 'border-ash-50 ring-1 ring-ash-50/40' : 'border-ash-600'
      }`}
    >
      {/* Category rail down the left edge */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold tracking-tight text-ash-50">
              {experience.role}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${tone.chip}`}
            >
              <Tag className="h-3 w-3" />
              {experience.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-ash-100">
            <Building2 className="h-3.5 w-3.5 text-ash-300" />
            <span>{experience.company}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {experience.dates && (
            <div className="flex items-center gap-1 rounded-md border border-ash-600 bg-ash-800 px-2.5 py-1 font-mono text-xs text-ash-100">
              <Calendar className="h-3 w-3 text-ash-300" />
              <span>{experience.dates}</span>
            </div>
          )}

          {(onEdit || onDelete) && (
            /* Actions stay dim until the card is hovered or focused inside,
               so a long list reads as content rather than as a toolbar. */
            <div className="flex gap-2 opacity-60 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
              {onEdit && (
                <button
                  onClick={onEdit}
                  aria-label={`Edit ${experience.role} at ${experience.company}`}
                  className="inline-flex items-center gap-1 rounded-md border border-ash-600 px-2.5 py-1 text-xs font-semibold text-ash-100 transition hover:-translate-y-0.5 hover:border-ash-400 hover:bg-ash-700 hover:text-ash-50"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  aria-label={`Delete ${experience.role} at ${experience.company}`}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2.5 py-1 text-xs font-semibold text-rose-400 transition hover:-translate-y-0.5 hover:border-rose-500/50 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <motion.ul layout className="mt-4 space-y-2.5 text-sm text-ash-100">
        <AnimatePresence initial={false}>
          {visibleBullets.map((b, idx) => (
            <motion.li
              key={b.id ?? idx}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="flex items-start gap-2"
            >
              <span className={`select-none font-bold ${tone.dot}`}>•</span>
              <div className="space-y-1.5">
                <p className="leading-relaxed">{b.text}</p>
                {b.skills && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-ash-200" />
                    {b.skills.split(',').map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="rounded-md border border-ash-500 bg-ash-700 px-2 py-0.5 font-mono text-[10px] font-medium text-ash-50 transition-colors hover:border-ash-400 hover:bg-ash-600"
                      >
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {collapsible && (
        <button
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ash-100 transition hover:text-ash-50"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-300 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
          {expanded
            ? 'Show less'
            : `Show ${hiddenCount} more bullet${hiddenCount === 1 ? '' : 's'}`}
        </button>
      )}
    </motion.div>
  );
}
