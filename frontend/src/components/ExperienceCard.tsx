'use client';

import { motion } from 'framer-motion';
import { Building2, Calendar, Pencil, Sparkles, Tag, Trash2 } from 'lucide-react';

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

export function ExperienceCard({
  experience,
  index,
  isEditing = false,
  onEdit,
  onDelete,
}: ExperienceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className={`border rounded-xl p-6 bg-white shadow-xs hover:shadow-md transition-all duration-200 space-y-4 ${
        isEditing ? 'ring-2 ring-blue-400 border-blue-300' : 'border-slate-200'
      }`}
    >
      {/* Card Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {experience.role}
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
              <Tag className="w-3 h-3 text-slate-500" />
              {experience.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{experience.company}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{experience.dates}</span>
          </div>

          {(onEdit || onDelete) && (
            <div className="flex gap-2">
              {onEdit && (
                <button
                  onClick={onEdit}
                  aria-label={`Edit ${experience.role} at ${experience.company}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  aria-label={`Delete ${experience.role} at ${experience.company}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bullet Points */}
      <ul className="space-y-2.5 text-sm text-slate-700">
        {experience.bullets.map((b, idx) => (
          <li key={b.id || idx} className="flex items-start gap-2">
            <span className="text-blue-500 font-bold select-none">•</span>
            <div className="space-y-1.5">
              <p className="leading-relaxed">{b.text}</p>
              {b.skills && (
                <div className="flex gap-1.5 flex-wrap items-center">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  {b.skills.split(',').map((skill, sIdx) => (
                    <span
                      key={sIdx}
                      className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-0.5 rounded-md font-medium"
                    >
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}