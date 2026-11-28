'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { Type } from 'lucide-react';
import { StudyFontId } from '@/domains/knowledge/types';
import { STUDY_FONT_OPTIONS } from '@/domains/canvas/utils/studyFonts';

interface StudyFontPickerProps {
  editor?: Editor | null;
  valueFontId?: StudyFontId;
  onSelectFont?: (fontId: StudyFontId) => void;
  align?: 'left' | 'right';
}

export function StudyFontPicker({
  editor,
  valueFontId,
  onSelectFont,
  align = 'left',
}: StudyFontPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const isControlled = Boolean(onSelectFont);
  const activeFontId = isControlled
    ? valueFontId ?? 'default'
    : ((editor?.getAttributes('studyFont')?.fontId as StudyFontId | undefined) ?? 'default');
  const activeOption = STUDY_FONT_OPTIONS.find((f) => f.id === activeFontId);

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
        className={`flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium transition ${
          activeFontId !== 'default' || open
            ? 'bg-indigo-600/25 text-indigo-200'
            : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
        }`}
        title="Trocar fonte de caderno / lettering"
      >
        <Type className="h-3.5 w-3.5 text-indigo-400" />
        <span
          style={{ fontFamily: activeOption?.cssFamily ?? 'inherit' }}
          className="hidden max-w-[68px] truncate sm:inline"
        >
          {activeFontId === 'default' ? 'Fonte' : activeOption?.label}
        </span>
      </button>

      {open && (
        <div
          className={`absolute top-full z-[160] mt-2 grid w-64 grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-[#161920]/98 p-2 shadow-2xl backdrop-blur-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {STUDY_FONT_OPTIONS.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() => {
                if (isControlled && onSelectFont) {
                  onSelectFont(font.id);
                } else if (editor) {
                  if (font.id === 'default') {
                    editor.chain().focus().unsetMark('studyFont').run();
                  } else {
                    editor.chain().focus().setMark('studyFont', { fontId: font.id }).run();
                  }
                }
                setOpen(false);
              }}
              style={{ fontFamily: font.cssFamily }}
              className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                activeFontId === font.id
                  ? 'border-indigo-500 bg-indigo-600/20 text-indigo-100'
                  : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700 hover:text-white'
              }`}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}