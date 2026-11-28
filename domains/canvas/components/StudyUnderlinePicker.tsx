'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { PenLine } from 'lucide-react';
import { StudyUnderlineVariant } from '@/domains/knowledge/extensions/StudyUnderlineMark';

const UL_VARIANTS: Array<{ id: StudyUnderlineVariant; label: string }> = [
  { id: 'brush', label: 'Pincel' },
  { id: 'wavy', label: 'Ondulado' },
  { id: 'double', label: 'Duplo' },
  { id: 'dashed', label: 'Tracejado' },
];

const UL_COLORS = [
  { label: 'Vermelho', hex: '#ef4444' },
  { label: 'Verde', hex: '#22c55e' },
  { label: 'Azul', hex: '#3b82f6' },
  { label: 'Amarelo', hex: '#eab308' },
  { label: 'Roxo', hex: '#a855f7' },
  { label: 'Rosa', hex: '#ec4899' },
  { label: 'Laranja', hex: '#f97316' },
];

interface StudyUnderlinePickerProps {
  editor?: Editor | null;
  onAfterApply?: () => void;
  // Modo controlado (Tópicos, Rótulos de Seta e elementos sem TipTap)
  active?: boolean;
  valueVariant?: StudyUnderlineVariant;
  valueColor?: string;
  onApplyStyle?: (variant: StudyUnderlineVariant, color: string) => void;
  onClearStyle?: () => void;
  align?: 'left' | 'right';
}

export function StudyUnderlinePicker({
  editor,
  onAfterApply,
  active,
  valueVariant,
  valueColor,
  onApplyStyle,
  onClearStyle,
  align = 'left',
}: StudyUnderlinePickerProps) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<StudyUnderlineVariant>(valueVariant ?? 'brush');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (valueVariant) setVariant(valueVariant);
  }, [valueVariant]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const isControlled = Boolean(onApplyStyle);
  const isActive = isControlled ? Boolean(active) : Boolean(editor?.isActive('studyUnderline'));
  const currentColor = valueColor || '#ef4444';

  const handleSelectVariant = (nextVariant: StudyUnderlineVariant) => {
    setVariant(nextVariant);
    // Se já estiver ativo no modo controlado, atualiza o tipo de traço ao vivo sem precisar clicar na cor de novo
    if (isControlled && isActive && onApplyStyle) {
      onApplyStyle(nextVariant, currentColor);
    }
  };

  const applyColor = (color: string) => {
    if (isControlled && onApplyStyle) {
      onApplyStyle(variant, color);
    } else if (editor) {
      editor.chain().focus().setMark('studyUnderline', { color, variant }).run();
      onAfterApply?.();
    }
    setOpen(false);
  };

  const handleClear = () => {
    if (isControlled && onClearStyle) {
      onClearStyle();
    } else if (editor) {
      editor.chain().focus().unsetMark('studyUnderline').run();
      onAfterApply?.();
    }
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-lg p-1.5 transition ${
          isActive || open
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'text-emerald-400 hover:bg-zinc-800 hover:text-emerald-200'
        }`}
        title="Sublinhado colorido (pincel, ondulado, duplo ou tracejado)"
        aria-label="Sublinhado colorido"
      >
        <PenLine className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className={`absolute top-full z-[160] mt-2 w-64 space-y-2.5 rounded-xl border border-zinc-800 bg-[#161920]/98 p-2.5 shadow-2xl backdrop-blur-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="grid grid-cols-4 gap-1">
            {UL_VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectVariant(v.id)}
                className={`rounded-lg border py-1 text-[10px] font-medium transition ${
                  variant === v.id
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                    : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span
                  className={`kc-ul kc-ul-${v.id}`}
                  style={{ ['--kc-ul-color' as string]: currentColor }}
                >
                  {v.label}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              {UL_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={`${variant} ${c.label}`}
                  onClick={() => applyColor(c.hex)}
                  className={`h-5 w-5 rounded-full border transition hover:scale-125 ${
                    isActive && valueColor === c.hex ? 'scale-110 border-white' : 'border-zinc-700'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
              title="Remover sublinhado colorido"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}