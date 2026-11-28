'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import { common, createLowlight } from 'lowlight';
import { StudyUnderlinePicker } from './StudyUnderlinePicker';
import { StudyFontPicker } from '@/domains/canvas/components/StudyFontPicker';
import { StudyFontMark } from '@/domains/knowledge/extensions/StudyFontMark';
import { buildCardTitleRenderProps } from '../utils/cardTitleStyle';   


import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  CheckSquare,
  Table as TableIcon,
  Sigma,
  GitFork,
  Link2,
  Quote,
  Check,
  EyeOff,
  Maximize2,
  List,
  Palette,
} from 'lucide-react';
import { CardTitleStyle, FullKnowledgeCard } from '@/domains/knowledge/types';
import { hexToRgbaString } from '../utils/contrast';
import { SmartFloatingPopover } from './SmartFloatingPopover';
import { DEFAULT_CARD_TYPOGRAPHY, resolveCardCallout, resolveCardTitleStyle } from '@/domains/knowledge/utils/defaults';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { MathBlock } from '@/domains/knowledge/extensions/MathBlock';
import { MermaidBlock } from '@/domains/knowledge/extensions/MermaidBlock';
import { WikiLinkNode, extractOutgoingLinkIds } from '@/domains/knowledge/extensions/WikiLinkNode';
import { StudyTapeMark } from '@/domains/knowledge/extensions/StudyTapeMark';
import { StudyUnderlineMark } from '@/domains/knowledge/extensions/StudyUnderlineMark';
import { buildTypographyCssVars, setCardPreviewCache } from './CardRichPreview';
import { TypographyPopover } from './TypographyPopover';
import { CalloutCustomizerPopover } from './CalloutCustomizerPopover';
import { getFontFamilyCss, getTextEffectClass } from '../utils/studyFonts';



const lowlight = createLowlight(common);

const InlineHorizontalRule = HorizontalRule.extend({
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

const QUICK_HIGHLIGHTS = ['#fde047', '#86efac', '#7dd3fc', '#f9a8d4'];
const QUICK_TEXT_COLORS = ['#e4e4e7', '#818cf8', '#34d399', '#fbbf24', '#fb7185'];

async function compressPastedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxWidth = 1200;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface InlineCardEditorProps {
  cardId: string;
  onFinish: () => void;
  onOpenDetails: () => void;
}

export function InlineCardEditor({ cardId, onFinish, onOpenDetails }: InlineCardEditorProps) {
  const { cardsById, updateCardMeta, saveCardContent } = useKnowledgeStore();
  const { addToast, theme } = useUiStore();

  const [fullCard, setFullCard] = useState<FullKnowledgeCard | null>(null);
  const [activeField, setActiveField] = useState<'title' | 'body'>('body');
  const [openPopover, setOpenPopover] = useState<null | 'highlight' | 'color' | 'link'>(null);
  const [linkQuery, setLinkQuery] = useState('');
  const [newTag, setNewTag] = useState('');

  const highlightBtnRef = useRef<HTMLButtonElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const linkBtnRef = useRef<HTMLButtonElement>(null);

  const fullCardRef = useRef<FullKnowledgeCard | null>(null);
  fullCardRef.current = fullCard;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const meta = cardsById[cardId];

  useEffect(() => {
    let active = true;
    getKnowledgeRepository()
      .getFullCard(cardId)
      .then((loaded) => {
        if (active && loaded) setFullCard(loaded);
      });
    return () => {
      active = false;
    };
  }, [cardId]);

  const flushSave = (ed: NonNullable<ReturnType<typeof useEditor>>) => {
    const current = fullCardRef.current;
    if (!current) return;
    const json = ed.getJSON() as Record<string, unknown>;
    const plainText = ed.getText();
    const outgoingLinkIds = extractOutgoingLinkIds(json);
    setCardPreviewCache(current.meta.id, json);

    saveCardContent(
      current.meta.id,
      { ...current.content, tiptapJson: json, plainText, updatedAt: Date.now() },
      plainText
    );

    if (current.meta.outgoingLinkIds.join(',') !== outgoingLinkIds.join(',')) {
      updateCardMeta(current.meta.id, { outgoingLinkIds });
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false, horizontalRule: false }),
      InlineHorizontalRule,
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
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: true }),
      CodeBlockLowlight.configure({ lowlight }),
      MathBlock,
      MermaidBlock,
      WikiLinkNode,
      Placeholder.configure({
        placeholder: 'Escreva direto aqui... (Ctrl+V cola prints • Esc conclui)',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'kc-inline-prose min-h-[44px] focus:outline-none',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (editorRef.current) flushSave(editorRef.current);
          onFinish();
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (!file) continue;
            event.preventDefault();
            compressPastedImage(file).then((dataUrl) => {
              editorRef.current?.chain().focus().setImage({ src: dataUrl }).run();
              addToast({ message: 'Print colado direto no card', variant: 'success' }, 2200);
            });
            return true;
          }
        }
        return false;
      },
    },
    onFocus: () => {
      setActiveField('body');
    },
    onUpdate: ({ editor: ed }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        flushSave(ed);
      }, 240);
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (editor && fullCard) {
      editor.commands.setContent(fullCard.content.tiptapJson, { emitUpdate: false });
      setTimeout(() => editor.commands.focus('end'), 30);
    }
  }, [editor, fullCard?.meta.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (editorRef.current && fullCardRef.current) {
        flushSave(editorRef.current);
      }
    };
  }, []);

  const linkableCards = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    return Object.values(cardsById)
      .filter((c) => c.id !== cardId)
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [cardsById, cardId, linkQuery]);

  if (!meta) return null;

  const typoStyle = buildTypographyCssVars(meta.typography, DEFAULT_CARD_TYPOGRAPHY);
  const calloutConfig = resolveCardCallout(meta);
  const isEditingTitle = activeField === 'title';

  const patchTitleStyle = (patch: Partial<CardTitleStyle>) => {
    const resolved = resolveCardTitleStyle(meta);
    updateCardMeta(cardId, {
      titleStyle: {
        ...resolved,
        color: resolved.color || undefined,
        bgColor: resolved.bgColor || undefined,
        underlineColor: resolved.underlineColor || undefined,
        highlightColor: resolved.highlightColor || undefined,
        ...patch,
      },
    });
  };
  const titleStyle = resolveCardTitleStyle(meta);
  const titleProps = buildCardTitleRenderProps(titleStyle);

  const handleAddTag = () => {
    const clean = newTag
      .trim()
      .toLowerCase()
      .replace(/^#+/, '')
      .replace(/\s+/g, '-');
    if (!clean || meta.tags.includes(clean)) {
      setNewTag('');
      return;
    }
    updateCardMeta(cardId, { tags: [...meta.tags, clean] });
    setNewTag('');
  };

  return (
    <div
      className="nodrag nowheel flex h-full flex-col"
      onClick={(e) => {
        e.stopPropagation();
        if (openPopover) setOpenPopover(null);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* BARRA FLUTUANTE DE FORMATAÇÃO ACIMA DO CARD (sem overflow clipping para popovers) */}
      {editor && (
        <div
          onMouseDown={(e) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
              e.preventDefault();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-12 left-1/2 z-[120] flex w-max max-w-[92vw] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-xl border border-indigo-500/35 bg-[#161920]/95 px-1.5 py-1 shadow-2xl backdrop-blur-xl"
        >
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: lvl as 1 | 2 | 3 }).run()}
              className={`rounded-lg px-1.5 py-1 text-[11px] font-bold transition ${
                editor.isActive('heading', { level: lvl })
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
              title={`Título H${lvl}`}
            >
              H{lvl}
            </button>
          ))}

          <div className="mx-0.5 h-4 w-px bg-zinc-800" />

          {isEditingTitle && (
            <span className="mr-0.5 rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
              Título
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              if (isEditingTitle) {
                patchTitleStyle({
                  fontWeight: titleStyle.fontWeight === 'bold' ? 'normal' : 'bold',
                });
              } else {
                editor.chain().focus().toggleBold().run();
              }
            }}
            className={`rounded-lg p-1.5 ${
              (isEditingTitle ? titleStyle.fontWeight === 'bold' : editor.isActive('bold'))
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Negrito"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isEditingTitle) {
                patchTitleStyle({ italic: !titleStyle.italic });
              } else {
                editor.chain().focus().toggleItalic().run();
              }
            }}
            className={`rounded-lg p-1.5 ${
              (isEditingTitle ? titleStyle.italic : editor.isActive('italic'))
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Itálico"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isEditingTitle) {
                patchTitleStyle({ underline: !titleStyle.underline });
              } else {
                editor.chain().focus().toggleUnderline().run();
              }
            }}
            className={`rounded-lg p-1.5 ${
              (isEditingTitle ? titleStyle.underline : editor.isActive('underline'))
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Sublinhado"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>

          {isEditingTitle ? (
            <StudyUnderlinePicker
              active={titleStyle.underline && titleStyle.underlineStyle !== 'solid'}
              valueVariant={
                titleStyle.underlineStyle !== 'solid' ? titleStyle.underlineStyle : 'brush'
              }
              valueColor={titleStyle.underlineColor || undefined}
              onApplyStyle={(variant, color) =>
                patchTitleStyle({
                  underline: true,
                  underlineStyle: variant,
                  underlineColor: color,
                })
              }
              onClearStyle={() =>
                patchTitleStyle({
                  underline: false,
                  underlineStyle: 'solid',
                  underlineColor: undefined,
                })
              }
            />
          ) : (
            <StudyUnderlinePicker editor={editor} />
          )}

          {isEditingTitle ? (
            <StudyFontPicker
              valueFontId={titleStyle.fontFamily}
              onSelectFont={(fontFamily) => patchTitleStyle({ fontFamily })}
            />
          ) : (
            <StudyFontPicker editor={editor} />
          )}

          {/* Tipografia (Fonte, Entrelinha e Parágrafos) — abre já na aba do campo focado */}
          <TypographyPopover
            compact
            defaultTab={activeField}
            value={meta.typography}
            defaults={DEFAULT_CARD_TYPOGRAPHY}
            onChange={(next) => updateCardMeta(cardId, { typography: next })}
            onReset={() => updateCardMeta(cardId, { typography: undefined })}
            titleStyle={meta.titleStyle}
            onTitleStyleChange={(next) => updateCardMeta(cardId, { titleStyle: next })}
            onTitleStyleReset={() => updateCardMeta(cardId, { titleStyle: undefined })}
          />

          {/* Marca-texto */}
          <div className="relative">
            <button
              ref={highlightBtnRef}
              type="button"
              onClick={() => setOpenPopover(openPopover === 'highlight' ? null : 'highlight')}
              className={`rounded-lg p-1.5 ${
                (isEditingTitle ? Boolean(titleStyle.highlightColor) : editor.isActive('highlight'))
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-amber-300 hover:bg-zinc-800'
              }`}
              title="Marca-texto"
            >
              <Highlighter className="h-3.5 w-3.5" />
            </button>
            <SmartFloatingPopover
              open={openPopover === 'highlight'}
              anchorRef={highlightBtnRef}
              onClose={() => setOpenPopover(null)}
              estimatedHeight={48}
              className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-[#161920]/98 p-1.5 shadow-2xl backdrop-blur-xl"
            >
              {QUICK_HIGHLIGHTS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    if (isEditingTitle) {
                      patchTitleStyle({ highlightColor: hexToRgbaString(hex, 0.36) });
                    } else {
                      editor.chain().focus().toggleHighlight({ color: hex }).run();
                    }
                    setOpenPopover(null);
                  }}
                  className="h-4 w-4 rounded border border-zinc-700 hover:scale-125"
                  style={{ backgroundColor: hex }}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  if (isEditingTitle) {
                    patchTitleStyle({ highlightColor: undefined });
                  } else {
                    editor.chain().focus().unsetHighlight().run();
                  }
                  setOpenPopover(null);
                }}
                className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-300"
              >
                ✕
              </button>
            </SmartFloatingPopover>
          </div>

          {/* Cor do texto */}
          <div className="relative">
            <button
              ref={colorBtnRef}
              type="button"
              onClick={() => setOpenPopover(openPopover === 'color' ? null : 'color')}
              className={`rounded-lg p-1.5 ${
                isEditingTitle && titleStyle.color
                  ? 'bg-indigo-600/25 text-indigo-200'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
              title="Cor do texto"
            >
              <Palette className="h-3.5 w-3.5" />
            </button>
            <SmartFloatingPopover
              open={openPopover === 'color'}
              anchorRef={colorBtnRef}
              onClose={() => setOpenPopover(null)}
              estimatedHeight={48}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#161920]/98 p-1.5 shadow-2xl backdrop-blur-xl"
            >
              {QUICK_TEXT_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    if (isEditingTitle) {
                      patchTitleStyle({ color: hex });
                    } else {
                      editor.chain().focus().setColor(hex).run();
                    }
                    setOpenPopover(null);
                  }}
                  className="h-4 w-4 rounded-full border border-zinc-700 hover:scale-125"
                  style={{ backgroundColor: hex }}
                />
              ))}
              <input
                type="color"
                value={titleStyle.color || '#ffffff'}
                onChange={(e) => {
                  if (isEditingTitle) patchTitleStyle({ color: e.target.value });
                  else editor.chain().focus().setColor(e.target.value).run();
                }}
                className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                title="Cor personalizada"
              />
              <button
                type="button"
                onClick={() => {
                  if (isEditingTitle) {
                    patchTitleStyle({ color: undefined });
                  } else {
                    editor.chain().focus().unsetColor().run();
                  }
                  setOpenPopover(null);
                }}
                className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-300"
              >
                ✕
              </button>
            </SmartFloatingPopover>
          </div>

          {/* Fita de Ocultação */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleMark('studyTape').run()}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
              editor.isActive('studyTape')
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
            }`}
            title="Aplicar Fita de Ocultação no texto selecionado"
          >
            <EyeOff className="h-3 w-3" /> Fita
          </button>

          <div className="mx-0.5 h-4 w-px bg-zinc-800" />

          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`rounded-lg p-1.5 ${editor.isActive('bulletList') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Lista"><List className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={`rounded-lg p-1.5 ${editor.isActive('taskList') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Checklist"><CheckSquare className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`rounded-lg p-1.5 ${editor.isActive('blockquote') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Lei Seca / Citação"><Quote className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800" title="Tabela 3×3"><TableIcon className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => editor.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run()} className="rounded-lg p-1.5 text-indigo-300 hover:bg-indigo-500/15" title="Fórmula KaTeX"><Sigma className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => editor.chain().focus().insertContent({ type: 'mermaidBlock' }).run()} className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-500/15" title="Diagrama Mermaid"><GitFork className="h-3.5 w-3.5" /></button>

          {/* Link Interno [[Card]] */}
          <div className="relative">
            <button
              ref={linkBtnRef}
              type="button"
              onClick={() => {
                setLinkQuery('');
                setOpenPopover(openPopover === 'link' ? null : 'link');
              }}
              className="rounded-lg p-1.5 text-sky-300 hover:bg-sky-500/15"
              title="Conectar outro Card"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
            <SmartFloatingPopover
              open={openPopover === 'link'}
              anchorRef={linkBtnRef}
              onClose={() => setOpenPopover(null)}
              width={228}
              estimatedHeight={200}
              align="right"
              className="rounded-xl border border-zinc-800 bg-[#161920]/98 p-2 shadow-2xl backdrop-blur-xl"
            >
              <input
                autoFocus
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
                placeholder="Buscar card..."
                className="mb-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
              />
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
                {linkableCards.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => {
                      editor
                        .chain()
                        .focus()
                        .insertContent({
                          type: 'wikiLink',
                          attrs: { cardId: target.id, label: target.title },
                        })
                        .run();
                      setOpenPopover(null);
                    }}
                    className="block w-full truncate rounded-lg px-2 py-1 text-left text-xs text-zinc-200 hover:bg-indigo-600/20"
                  >
                    {target.title}
                  </button>
                ))}
              </div>
            </SmartFloatingPopover>
          </div>

          <div className="mx-0.5 h-4 w-px bg-zinc-800" />

          <button
            type="button"
            onClick={() => {
              flushSave(editor);
              onOpenDetails();
            }}
            className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-indigo-300"
            title="Abrir Edição Avançada (Anexos, Flashcards e Metadados)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              flushSave(editor);
              onFinish();
            }}
            className="ml-0.5 flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-500"
            title="Concluir edição (Esc)"
          >
            <Check className="h-3.5 w-3.5" /> OK
          </button>
        </div>
      )}

      {/* TÍTULO EDITÁVEL INLINE */}
      <div style={titleProps.wrapperStyle} className={`mb-1.5 w-full ${titleProps.wrapperClassName}`}>
        <input
          value={meta.title}
          onFocus={() => setActiveField('title')}
          onChange={(e) => updateCardMeta(cardId, { title: e.target.value })}
          placeholder="Título do Card..."
          style={titleProps.textStyle}
          className={`w-full bg-transparent leading-snug tracking-tight text-zinc-100 placeholder:text-zinc-500 focus:outline-none ${titleProps.textClassName}`}
        />
      </div>

      {/* CONTEÚDO RICO COM TIPOGRAFIA EM TEMPO REAL */}
      <div style={typoStyle} className="kc-no-scrollbar min-h-0 flex-1 cursor-text overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* OBSERVAÇÃO RÁPIDA / PEGADINHA INLINE + PERSONALIZADOR */}
      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={calloutConfig.text ?? ''}
          onChange={(e) =>
            updateCardMeta(cardId, {
              notes: e.target.value,
              callout: { ...calloutConfig, text: e.target.value },
            })
          }
          placeholder="Nota / pegadinha de banca..."
          className="min-w-0 flex-1 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-1 text-[11px] text-amber-200 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
        />
        <CalloutCustomizerPopover
          compact
          align="right"
          value={calloutConfig}
          theme={theme}
          onChange={(next) =>
            updateCardMeta(cardId, {
              notes: next.text ?? '',
              callout: next,
            })
          }
        />
      </div>

      {/* TAGS INLINE */}
      <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-zinc-800/70 pt-1.5">
        {meta.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300"
          >
            #{tag}
            <button
              type="button"
              onClick={() => updateCardMeta(cardId, { tags: meta.tags.filter((t) => t !== tag) })}
              className="text-zinc-500 hover:text-rose-400"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddTag();
            }
          }}
          placeholder="+ tag"
          className="w-16 bg-transparent px-1 text-[10.5px] text-zinc-300 placeholder:text-zinc-500 focus:outline-none"
        />
      </div>
    </div>
  );
}