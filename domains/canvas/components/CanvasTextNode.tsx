'use client';

import React, { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Palette,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  EyeOff,
  Check,
} from 'lucide-react';
import { CanvasNodePosition } from '@/domains/knowledge/types';
import { DEFAULT_TEXT_TYPOGRAPHY, resolveTypography } from '@/domains/knowledge/utils/defaults';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { StudyTapeMark } from '@/domains/knowledge/extensions/StudyTapeMark';
import { RichDocRenderer, buildTypographyCssVars } from './CardRichPreview';
import { TypographyPopover } from './TypographyPopover';
import { CalloutBadge } from './CalloutBadge';

const HANDLES = [
  { pos: Position.Top, id: 'top' },
  { pos: Position.Right, id: 'right' },
  { pos: Position.Bottom, id: 'bottom' },
  { pos: Position.Left, id: 'left' },
];

const BORDER_WIDTH_PX: Record<NonNullable<CanvasNodePosition['borderWidth']>, number> = {
  thin: 1,
  medium: 2,
  thick: 4,
};

const RADIUS_CLASS: Record<NonNullable<CanvasNodePosition['borderRadius']>, string> = {
  none: 'rounded-none',
  md: 'rounded-lg',
  xl: 'rounded-2xl',
  full: 'rounded-3xl',
};

const PADDING_CLASS: Record<NonNullable<CanvasNodePosition['padding']>, string> = {
  none: 'p-1',
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
  lg: 'px-6 py-4',
};

const INLINE_TEXT_COLORS = [
  { label: 'Padrão', value: '' },
  { label: 'Branco', value: '#f4f4f5' },
  { label: 'Grafite', value: '#18181b' },
  { label: 'Índigo', value: '#818cf8' },
  { label: 'Azul', value: '#38bdf8' },
  { label: 'Verde', value: '#34d399' },
  { label: 'Âmbar', value: '#fbbf24' },
  { label: 'Rosa', value: '#fb7185' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Sem marca', value: '' },
  { label: 'Amarelo', value: 'rgba(250, 204, 21, 0.35)' },
  { label: 'Verde', value: 'rgba(52, 211, 153, 0.30)' },
  { label: 'Azul', value: 'rgba(56, 189, 248, 0.30)' },
  { label: 'Rosa', value: 'rgba(251, 113, 133, 0.32)' },
  { label: 'Roxo', value: 'rgba(167, 139, 250, 0.32)' },
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface FreeTextInlineEditorProps {
  node: CanvasNodePosition;
  onSave: (json: Record<string, unknown>, plainText: string) => void;
  onTypographyChange: (next: Required<NonNullable<CanvasNodePosition['typography']>>) => void;
  onTypographyReset: () => void;
  onDone: () => void;
}

function FreeTextInlineEditor({
  node,
  onSave,
  onTypographyChange,
  onTypographyReset,
  onDone,
}: FreeTextInlineEditorProps) {
  const [openPicker, setOpenPicker] = useState<'color' | 'highlight' | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      StudyTapeMark,
    ],
    content: node.textJson ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'kc-free-text-prose ProseMirror focus:outline-none min-h-[1.6em]',
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const json = ed.getJSON() as Record<string, unknown>;
      const plain = ed.getText({ blockSeparator: '\n' });
      saveTimerRef.current = setTimeout(() => {
        onSaveRef.current(json, plain);
      }, 220);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const t = setTimeout(() => {
      editor.commands.focus('end');
    }, 20);
    return () => clearTimeout(t);
  }, [editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (editor && !editor.isDestroyed) {
        onSaveRef.current(
          editor.getJSON() as Record<string, unknown>,
          editor.getText({ blockSeparator: '\n' })
        );
      }
    };
  }, [editor]);

  const flushAndDone = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (editor && !editor.isDestroyed) {
      onSaveRef.current(
        editor.getJSON() as Record<string, unknown>,
        editor.getText({ blockSeparator: '\n' })
      );
    }
    onDone();
  };

  if (!editor) return null;

  const btn = (active: boolean) =>
    `rounded-lg p-1.5 text-xs transition ${
      active
        ? 'bg-indigo-600/30 text-indigo-200'
        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
    }`;

  return (
    <div
      className="nodrag nowheel relative w-full"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          flushAndDone();
        }
      }}
    >
      {/* BARRA FLUTUANTE DE FORMATAÇÃO RICA */}
      <div
        onMouseDown={(e) => {
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA') e.preventDefault();
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute -top-12 left-1/2 z-[120] flex w-max max-w-[92vw] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-xl border border-indigo-500/40 bg-[#161920]/95 px-1.5 py-1 shadow-2xl backdrop-blur-xl"
      >
        {([1, 2, 3] as const).map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: lvl }).run()}
            className={`${btn(editor.isActive('heading', { level: lvl }))} px-1.5 font-bold`}
            title={`Título H${lvl}`}
          >
            H{lvl}
          </button>
        ))}

        <div className="mx-0.5 h-4 w-px bg-zinc-800" />

        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))} title="Negrito (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))} title="Itálico (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))} title="Sublinhado (Ctrl+U)"><UnderlineIcon className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))} title="Tachado"><Strikethrough className="h-3.5 w-3.5" /></button>

        {/* Tipografia completa em tempo real */}
        <TypographyPopover
          compact
          value={node.typography}
          legacyFontSize={node.fontSize}
          defaults={DEFAULT_TEXT_TYPOGRAPHY}
          onChange={onTypographyChange}
          onReset={onTypographyReset}
        />

        <div className="mx-0.5 h-4 w-px bg-zinc-800" />

        {/* Cor do Texto */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPicker(openPicker === 'color' ? null : 'color')}
            className={btn(openPicker === 'color')}
            title="Cor do texto selecionado"
          >
            <Palette className="h-3.5 w-3.5 text-sky-400" />
          </button>
          {openPicker === 'color' && (
            <div className="absolute left-0 top-full z-50 mt-1.5 flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#161920] p-2 shadow-2xl">
              {INLINE_TEXT_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  title={c.label}
                  onClick={() => {
                    if (c.value) editor.chain().focus().setColor(c.value).run();
                    else editor.chain().focus().unsetColor().run();
                    setOpenPicker(null);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 text-[9px] font-bold text-zinc-400 transition hover:scale-110"
                  style={c.value ? { backgroundColor: c.value } : undefined}
                >
                  {!c.value && '✕'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Marca-Texto */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPicker(openPicker === 'highlight' ? null : 'highlight')}
            className={btn(editor.isActive('highlight') || openPicker === 'highlight')}
            title="Marca-texto"
          >
            <Highlighter className="h-3.5 w-3.5 text-amber-400" />
          </button>
          {openPicker === 'highlight' && (
            <div className="absolute left-0 top-full z-50 mt-1.5 flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#161920] p-2 shadow-2xl">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  title={c.label}
                  onClick={() => {
                    if (c.value) editor.chain().focus().setHighlight({ color: c.value }).run();
                    else editor.chain().focus().unsetHighlight().run();
                    setOpenPicker(null);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-md border border-zinc-700 text-[9px] font-bold text-zinc-400 transition hover:scale-110"
                  style={c.value ? { backgroundColor: c.value } : undefined}
                >
                  {!c.value && '✕'}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleMark('studyTape').run()}
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
            editor.isActive('studyTape')
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
          }`}
          title="Fita de ocultação"
        >
          <EyeOff className="h-3 w-3" /> Fita
        </button>

        <div className="mx-0.5 h-4 w-px bg-zinc-800" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))} title="Lista"><List className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={btn(editor.isActive('taskList'))} title="Checklist"><CheckSquare className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive('blockquote'))} title="Citação"><Quote className="h-3.5 w-3.5" /></button>

        <div className="mx-0.5 h-4 w-px bg-zinc-800" />

        <button
          type="button"
          onClick={flushAndDone}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-500"
          title="Concluir edição (Esc)"
        >
          <Check className="h-3.5 w-3.5" /> OK
        </button>
      </div>

      {/* ÁREA DE DIGITAÇÃO */}
      <div className="relative w-full cursor-text">
        {editor.isEmpty && (
          <span className="pointer-events-none absolute left-0 top-0 select-none text-zinc-500/80">
            Digite livremente...
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

interface CanvasTextNodeData {
  node: CanvasNodePosition;
}

export const CanvasTextNode = memo(function CanvasTextNode({
  id,
  data,
  selected,
}: NodeProps & { data: CanvasTextNodeData }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const persistNodePositions = useKnowledgeStore((s) => s.persistNodePositions);
  const updateCanvasNode = useKnowledgeStore((s) => s.updateCanvasNode);
  const { theme, editingTextNodeId, setEditingTextNodeId } = useUiStore();
  const { node } = data;

  const isEditing = editingTextNodeId === id;
  const resolvedTypo = resolveTypography(node.typography, DEFAULT_TEXT_TYPOGRAPHY, node.fontSize);
  const typoVars = buildTypographyCssVars(node.typography, DEFAULT_TEXT_TYPOGRAPHY, node.fontSize);

  useEffect(() => {
    const t = setTimeout(() => updateNodeInternals(id), 40);
    return () => clearTimeout(t);
  }, [
    id,
    resolvedTypo.fontSize,
    resolvedTypo.lineHeight,
    resolvedTypo.paragraphSpacing,
    node.callout?.visible,
    node.callout?.position,
    isEditing,
    updateNodeInternals,
  ]);

  useEffect(() => {
    if (!isEditing) return;
    const onGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingTextNodeId(null);
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [isEditing, setEditingTextNodeId]);

  const bgOpacity = node.bgOpacity ?? 'transparent';
  const fillHex = node.bgColor ?? node.color ?? '#6366f1';
  const bgStyleColor =
    bgOpacity === 'transparent'
      ? 'transparent'
      : bgOpacity === 'solid'
      ? fillHex
      : bgOpacity === 'tinted'
      ? hexToRgba(fillHex, theme === 'paper' ? 0.22 : 0.2)
      : hexToRgba(fillHex, theme === 'paper' ? 0.1 : 0.08);

  const borderStyle = node.borderStyle ?? 'none';
  const borderWidth = borderStyle === 'none' ? 0 : BORDER_WIDTH_PX[node.borderWidth ?? 'thin'];
  const borderColor = node.color ?? '#6366f1';
  const radiusClass = RADIUS_CLASS[node.borderRadius ?? 'xl'];
  const paddingClass = PADDING_CLASS[node.padding ?? 'sm'];

  const defaultTextColor =
    bgOpacity === 'solid'
      ? '#ffffff'
      : theme === 'paper'
      ? '#18181b'
      : '#f4f4f5';

  const hasContent = Boolean((node.plainText ?? '').trim().length > 0);
  const hasCallout = Boolean((node.callout?.text ?? '').trim()) && node.callout?.visible !== false;
  const calloutPos = node.callout?.position ?? 'bottom';

  return (
    <div
      style={{
        minHeight: node.height && node.height > 0 ? node.height : undefined,
      }}
      className={`group relative flex w-full flex-col ${radiusClass} transition-shadow ${
        isEditing
          ? 'z-50 ring-2 ring-indigo-500/80 shadow-xl shadow-indigo-500/15'
          : selected
          ? 'ring-2 ring-indigo-500/70'
          : 'hover:ring-1 hover:ring-indigo-400/35'
      }`}
    >
      <NodeResizer
        isVisible={selected || isEditing}
        minWidth={120}
        minHeight={36}
        lineClassName="!border-indigo-500/70"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-indigo-400 !bg-[#161920]"
        onResizeEnd={(_, params) => {
          persistNodePositions([
            {
              id,
              x: Math.round(params.x),
              y: Math.round(params.y),
              width: Math.round(params.width),
              height: Math.round(params.height),
              sizingMode: 'custom',
            },
          ]);
        }}
      />

      {!isEditing &&
        HANDLES.map((h) => (
          <React.Fragment key={h.id}>
            <Handle
              type="target"
              position={h.pos}
              id={`t-${h.id}`}
              className={`!z-50 !h-3 !w-3 !border-2 !border-[#161920] !bg-indigo-400 transition-opacity ${
                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
            <Handle
              type="source"
              position={h.pos}
              id={`s-${h.id}`}
              className={`!z-50 !h-3 !w-3 !border-2 !border-[#161920] !bg-indigo-400 transition-opacity ${
                selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
          </React.Fragment>
        ))}

      <div
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditingTextNodeId(id);
        }}
        style={{
          ...typoVars,
          backgroundColor: bgStyleColor,
          borderWidth,
          borderStyle: borderStyle === 'none' ? 'solid' : borderStyle,
          borderColor:
            borderStyle === 'none' ? 'transparent' : hexToRgba(borderColor, selected ? 0.9 : 0.55),
          color: node.textColor || defaultTextColor,
          fontSize: `${resolvedTypo.fontSize}px`,
          lineHeight: resolvedTypo.lineHeight,
          textAlign: node.textAlign ?? 'left',
          minHeight: node.height && node.height > 0 ? node.height : undefined,
        }}
        className={`w-full ${radiusClass} ${paddingClass} transition-colors ${
          bgOpacity !== 'transparent' ? 'backdrop-blur-sm shadow-lg' : ''
        }`}
      >
        {!isEditing && hasCallout && (calloutPos === 'top' || calloutPos === 'badge') && (
          <CalloutBadge config={node.callout!} theme={theme} className="mb-2" />
        )}

        {isEditing ? (
          <FreeTextInlineEditor
            node={node}
            onSave={(json, plainText) => updateCanvasNode(id, { textJson: json, plainText })}
            onTypographyChange={(next) =>
              updateCanvasNode(id, { typography: next, fontSize: next.fontSize })
            }
            onTypographyReset={() =>
              updateCanvasNode(id, {
                typography: undefined,
                fontSize: DEFAULT_TEXT_TYPOGRAPHY.fontSize,
              })
            }
            onDone={() => setEditingTextNodeId(null)}
          />
        ) : hasContent ? (
          <RichDocRenderer
            doc={node.textJson}
            className="kc-free-text-prose"
            typography={node.typography}
            legacyFontSize={node.fontSize}
          />
        ) : (
          <p className="select-none italic opacity-45">Duplo clique para digitar...</p>
        )}

        {!isEditing && hasCallout && calloutPos !== 'top' && calloutPos !== 'badge' && (
          <CalloutBadge config={node.callout!} theme={theme} className="mt-2" />
        )}
      </div>
    </div>
  );
});