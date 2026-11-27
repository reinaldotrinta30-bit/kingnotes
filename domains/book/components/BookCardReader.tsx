'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import { common, createLowlight } from 'lowlight';
import { Bookmark, Edit3, Flame, Highlighter, Palette, Pin, Star, Brain } from 'lucide-react';
import { KnowledgeCardContent, KnowledgeCardMeta } from '@/domains/knowledge/types';
import { DEFAULT_CARD_TYPOGRAPHY, resolveCardCallout } from '@/domains/knowledge/utils/defaults';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { MathBlock } from '@/domains/knowledge/extensions/MathBlock';
import { MermaidBlock } from '@/domains/knowledge/extensions/MermaidBlock';
import { WikiLinkNode } from '@/domains/knowledge/extensions/WikiLinkNode';
import { StudyTapeMark } from '@/domains/knowledge/extensions/StudyTapeMark';
import { StudyUnderlineMark } from '@/domains/knowledge/extensions/StudyUnderlineMark';
import { buildTypographyCssVars } from '@/domains/canvas/components/CardRichPreview';
import { CalloutBadge } from '@/domains/canvas/components/CalloutBadge';
import { resolveCardTitleStyle } from '@/domains/knowledge/utils/defaults';
import { StudyFontMark } from '@/domains/knowledge/extensions/StudyFontMark';
import { getFontFamilyCss, getTextEffectClass } from '@/domains/canvas/utils/studyFonts';

const lowlight = createLowlight(common);

const BookHorizontalRule = HorizontalRule.extend({
  addAttributes() {
    return {
      class: {
        default: 'kc-hr-solid',
        parseHTML: (el) => el.getAttribute('class') || 'kc-hr-solid',
        renderHTML: (attrs) => ({ class: attrs.class }),
      },
    };
  },
});

const PEN_HIGHLIGHTS = [
  { hex: '#fde047', label: 'Amarelo' },
  { hex: '#86efac', label: 'Verde' },
  { hex: '#7dd3fc', label: 'Azul' },
  { hex: '#f9a8d4', label: 'Rosa' },
];

const PEN_COLORS = [
  { hex: '#34d399', label: 'Verde' },
  { hex: '#fbbf24', label: 'Âmbar' },
  { hex: '#fb7185', label: 'Rosa' },
];

interface BookCardReaderProps {
  card: KnowledgeCardMeta;
  penModeEnabled: boolean;
  showCallouts?: boolean;
  hideTitle?: boolean;
  isPrintSheet?: boolean;
  onOpenEditor: (cardId: string) => void;
  onOpenNotebooks: (cardId: string) => void;
}

export function BookCardReader({
  card,
  penModeEnabled,
  showCallouts = true,
  hideTitle = false,
  isPrintSheet = false,
  onOpenEditor,
  onOpenNotebooks,
}: BookCardReaderProps) {
  const saveCardContent = useKnowledgeStore((s) => s.saveCardContent);
  const { theme, preferences } = useUiStore();

  const effectiveTheme: 'dark' | 'paper' = isPrintSheet ? 'paper' : theme;

  const bookTypographyClass = [
    preferences.bookFont === 'sans'
      ? '[&_.ProseMirror]:!font-sans'
      : '[&_.ProseMirror]:!font-serif',
    preferences.bookFontSize === 'sm'
      ? '[&_.ProseMirror]:!text-[14.5px]'
      : preferences.bookFontSize === 'lg'
      ? '[&_.ProseMirror]:!text-[18.5px]'
      : '[&_.ProseMirror]:!text-[16px]',
    effectiveTheme === 'paper'
      ? '[&_.ProseMirror]:!text-zinc-800'
      : '[&_.ProseMirror]:!text-zinc-200',
  ].join(' ');

  const [content, setContent] = useState<KnowledgeCardContent | null>(null);
  const [isSelected, setIsSelected] = useState(false);
  const contentRef = useRef<KnowledgeCardContent | null>(null);
  contentRef.current = content;

  useEffect(() => {
    let active = true;
    getKnowledgeRepository()
      .getFullCard(card.id)
      .then((full) => {
        if (active && full) setContent(full.content);
      });
    return () => {
      active = false;
    };
  }, [card.id, card.updatedAt]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false, horizontalRule: false }),
      BookHorizontalRule,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      StudyTapeMark,
      StudyUnderlineMark,
      StudyFontMark,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      CodeBlockLowlight.configure({ lowlight }),
      MathBlock,
      MermaidBlock,
      WikiLinkNode,
    ],
    editorProps: {
      attributes: {
        class: 'book-prose font-serif text-[16px] leading-[1.82] focus:outline-none',
      },
      handleKeyDown: (_view, event) => {
        const allowed = [
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Shift',
          'Control',
          'Meta',
          'Alt',
          'Home',
          'End',
          'PageUp',
          'PageDown',
        ];
        if (event.ctrlKey || event.metaKey || allowed.includes(event.key)) return false;
        return true;
      },
    },
    onFocus: () => setIsSelected(true),
    onBlur: () => setTimeout(() => setIsSelected(false), 180),
  });

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content.tiptapJson, { emitUpdate: false });
    }
  }, [editor, content]);

  const persistHighlightChange = () => {
    if (!editor || !contentRef.current) return;
    const json = editor.getJSON() as Record<string, unknown>;
    const plainText = editor.getText();
    const updated: KnowledgeCardContent = {
      ...contentRef.current,
      tiptapJson: json,
      plainText,
      updatedAt: Date.now(),
    };
    setContent(updated);
    saveCardContent(card.id, updated, plainText);
  };

  const callout = resolveCardCallout(card);
  const hasVisibleCallout =
    showCallouts && Boolean((callout.text ?? '').trim()) && callout.visible !== false;
  const typoStyle = buildTypographyCssVars(card.typography, DEFAULT_CARD_TYPOGRAPHY);
  const titleStyle = resolveCardTitleStyle(card);

  return (
    <article
      id={`card-${card.id}`}
      className={`kc-book-avoid-break group relative rounded-2xl border p-6 transition ${
        effectiveTheme === 'paper'
          ? penModeEnabled && isSelected
            ? 'border-indigo-400 bg-white ring-1 ring-indigo-400/40'
            : 'border-stone-200/90 bg-white/95 hover:border-stone-300'
          : penModeEnabled && isSelected
          ? 'border-indigo-500/50 bg-[#161920] ring-1 ring-indigo-500/30'
          : 'border-zinc-800/75 bg-[#161920] hover:border-zinc-700/80'
      }`}
    >
      {/* Cabeçalho do Artigo (oculto apenas quando o card já está promovido a título de Capítulo/Seção acima) */}
      {!hideTitle && (
        <div
          className={`mb-4 flex items-start justify-between gap-4 border-b pb-3 ${
            effectiveTheme === 'paper' ? 'border-stone-200' : 'border-zinc-800/70'
          }`}
        >
          <div className="flex items-center gap-2">
            {card.emoji && <span className="text-lg">{card.emoji}</span>}
            <h3
  className={`text-lg font-semibold tracking-tight ${
    effectiveTheme === 'paper' ? 'text-zinc-900' : 'text-zinc-100'
  } ${getTextEffectClass(titleStyle.textEffect)}`}
  style={{
    fontFamily: getFontFamilyCss(titleStyle.fontFamily),
    fontStyle: titleStyle.italic ? 'italic' : 'normal',
    textDecoration: titleStyle.underline ? 'underline' : 'none',
  }}
>
  {card.title}
</h3>
          </div>

          <div className="kc-no-print flex shrink-0 items-center gap-1.5">
            {card.importance === 'critical' && (
              <span title="Crítico em prova">
                <Flame className="h-4 w-4 text-rose-500" />
              </span>
            )}
            {card.isPinned && <Pin className="h-3.5 w-3.5 text-indigo-400" />}
            {card.isFavorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            {(content?.flashcards.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400">
                <Brain className="h-3 w-3" /> {content?.flashcards.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => onOpenNotebooks(card.id)}
              className={`rounded-lg p-1.5 transition ${
                (card.notebookIds?.length ?? 0) > 0
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : 'text-zinc-500 opacity-0 hover:bg-zinc-800 hover:text-zinc-200 group-hover:opacity-100'
              }`}
              title="Vincular a Meus Cadernos"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onOpenEditor(card.id)}
              className="flex items-center gap-1 rounded-lg bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-200 opacity-0 transition group-hover:opacity-100 hover:bg-indigo-600 hover:text-white"
            >
              <Edit3 className="h-3 w-3" /> Editar
            </button>
          </div>
        </div>
      )}

      {/* Barra Flutuante de Canetas (Modo Canetas) */}
      {penModeEnabled && editor && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="kc-no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-500/25 bg-[#0F1115]/90 px-3 py-1.5 text-[11px]"
        >
          <span className="font-semibold uppercase tracking-wider text-indigo-300">
            Canetas (selecione o texto):
          </span>
          <div className="flex items-center gap-1">
            {PEN_HIGHLIGHTS.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color: p.hex }).run();
                  persistHighlightChange();
                }}
                className="flex h-5 w-5 items-center justify-center rounded border border-zinc-700 text-zinc-900 transition hover:scale-110"
                style={{ backgroundColor: p.hex }}
                title={`Marca-texto ${p.label}`}
              >
                <Highlighter className="h-3 w-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                persistHighlightChange();
              }}
              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
            >
              Limpar
            </button>
          </div>
          <div className="h-3.5 w-px bg-zinc-800" />
          <div className="flex items-center gap-1">
            {PEN_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  editor.chain().focus().setColor(c.hex).run();
                  persistHighlightChange();
                }}
                className="h-4 w-4 rounded-full border border-zinc-700 transition hover:scale-110"
                style={{ backgroundColor: c.hex }}
                title={`Texto ${c.label}`}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                persistHighlightChange();
              }}
              className="rounded bg-zinc-800 p-1 text-zinc-400 hover:text-zinc-100"
              title="Cor original"
            >
              <Palette className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Observação no Topo ou Etiqueta */}
      {hasVisibleCallout && (callout.position === 'top' || callout.position === 'badge') && (
        <CalloutBadge config={callout} theme={effectiveTheme} className="mb-4" />
      )}

      {/* Conteúdo Rico Completo */}
      {content ? (
        <div style={typoStyle} className={bookTypographyClass}>
          <EditorContent editor={editor} />
        </div>
      ) : (
        <p
          className={`font-serif text-[16px] leading-7 ${
            effectiveTheme === 'paper' ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        >
          {card.excerpt}
        </p>
      )}

      {/* Observação / Pegadinha Personalizada preservada */}
      {hasVisibleCallout && callout.position !== 'top' && callout.position !== 'badge' && (
        <CalloutBadge config={callout} theme={effectiveTheme} className="mt-4" />
      )}

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 pt-2">
          {card.tags.map((t) => (
            <span
              key={t}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                effectiveTheme === 'paper'
                  ? 'bg-stone-100 text-stone-600'
                  : 'bg-zinc-900 text-zinc-400'
              }`}
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}