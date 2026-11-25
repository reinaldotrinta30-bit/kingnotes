'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Code2,
  Minus,
  Sigma,
  GitFork,
  Link2,
  Paperclip,
  Pin,
  Star,
  Flame,
  X,
  Plus,
  Brain,
  Trash2,
  Maximize2,
  Minimize2,
  Tag,
  ArrowUpRight,
  FolderTree,
  Bookmark,
  Columns2,
  Scissors,
  Heading1,
  Heading2,
  Sparkles,
  Braces,
} from 'lucide-react';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import {
  EmbeddedFlashcard,
  FullKnowledgeCard,
  ImportanceLevel,
  KnowledgeCardMeta,
  LocalAttachment,
} from '../types';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { MathBlock } from '../extensions/MathBlock';
import { MermaidBlock } from '../extensions/MermaidBlock';
import { WikiLinkNode, extractOutgoingLinkIds } from '../extensions/WikiLinkNode';
import { AttachmentManager } from './AttachmentManager';
import { NotebookPickerModal } from './NotebookPickerModal';

const lowlight = createLowlight(common);

const CustomHorizontalRule = HorizontalRule.extend({
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

const CARD_COLORS: Array<{ id: KnowledgeCardMeta['color']; label: string; dot: string }> = [
  { id: 'default', label: 'Neutro', dot: '#52525b' },
  { id: 'violet', label: 'Violeta', dot: '#8b5cf6' },
  { id: 'sky', label: 'Azul', dot: '#0ea5e9' },
  { id: 'emerald', label: 'Verde', dot: '#10b981' },
  { id: 'amber', label: 'Âmbar', dot: '#f59e0b' },
  { id: 'rose', label: 'Rosa', dot: '#f43f5e' },
];

const TEXT_COLORS = ['#e4e4e7', '#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#f97316'];
const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#7dd3fc', '#f9a8d4', '#fdba74'];

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxWidth = 1400;
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

interface FloatingTriggerMenu {
  kind: 'slash' | 'wikilink';
  query: string;
  range: { from: number; to: number };
  top: number;
  left: number;
}

interface BubbleMenuState {
  top: number;
  left: number;
  from: number;
  to: number;
  selectedText: string;
}

interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  run: (ed: NonNullable<ReturnType<typeof useEditor>>) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'h1',
    label: 'Título Principal (H1)',
    description: 'Seção de destaque',
    keywords: 'titulo h1 heading cabecalho',
    icon: Heading1,
    run: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Subtítulo (H2)',
    description: 'Divisão de assunto',
    keywords: 'subtitulo h2 heading',
    icon: Heading2,
    run: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'checklist',
    label: 'Checklist de Estudo',
    description: 'Lista marcável de pontos',
    keywords: 'checklist tarefa todo check',
    icon: CheckSquare,
    run: (ed) => ed.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'table',
    label: 'Tabela Comparativa (3×3)',
    description: 'Ótima para quadros de prazos e diferenças',
    keywords: 'tabela table quadro comparativo',
    icon: TableIcon,
    run: (ed) => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'math',
    label: 'Fórmula Matemática (KaTeX)',
    description: 'Equações em LaTeX',
    keywords: 'formula matematica latex katex equacao',
    icon: Sigma,
    run: (ed) => ed.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run(),
  },
  {
    id: 'diagram',
    label: 'Diagrama / Fluxograma (Mermaid)',
    description: 'Fluxos de ritos e processos',
    keywords: 'diagrama fluxograma mermaid mapa',
    icon: GitFork,
    run: (ed) => ed.chain().focus().insertContent({ type: 'mermaidBlock' }).run(),
  },
  {
    id: 'quote',
    label: 'Citação / Lei Seca',
    description: 'Bloco destacado para artigo literal',
    keywords: 'citacao lei seca artigo quote',
    icon: Quote,
    run: (ed) => ed.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'code',
    label: 'Bloco de Código',
    description: 'Trecho monoespaçado',
    keywords: 'codigo code sql json',
    icon: Code2,
    run: (ed) => ed.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'hr',
    label: 'Linha Divisória Tracejada',
    description: 'Separador visual de blocos',
    keywords: 'linha divisoria hr separador',
    icon: Minus,
    run: (ed) =>
      ed.chain().focus().insertContent({ type: 'horizontalRule', attrs: { class: 'kc-hr-dashed' } }).run(),
  },
];

interface KnowledgeCardEditorPaneProps {
  fullCard: FullKnowledgeCard;
  slot: 'primary' | 'secondary';
  isSplitActive: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClose: () => void;
}

export function KnowledgeCardEditorPane({
  fullCard,
  slot,
  isSplitActive,
  isExpanded = false,
  onToggleExpand,
  onClose,
}: KnowledgeCardEditorPaneProps) {
  const {
    cardsById,
    hierarchy,
    openCard,
    openSecondaryCard,
    updateCardMeta,
    saveCardContent,
    deleteCard,
    restoreCardBundle,
    extractSelectionToCard,
  } = useKnowledgeStore();
  const { openConfirm, addToast } = useUiStore();

  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});

  // Popovers da barra fixa
  const [openMenu, setOpenMenu] = useState<
    null | 'table' | 'hr' | 'color' | 'highlight' | 'wikilink' | 'splitpicker'
  >(null);
  const [wikiQuery, setWikiQuery] = useState('');

  // Menus inteligentes no cursor: Slash (/) e WikiLink ([[)
  const [triggerMenu, setTriggerMenu] = useState<FloatingTriggerMenu | null>(null);
  const [triggerIndex, setTriggerIndex] = useState(0);

  // Bubble Menu contextual ao selecionar texto
  const [bubbleMenu, setBubbleMenu] = useState<BubbleMenuState | null>(null);
  const [quickFlashcardMode, setQuickFlashcardMode] = useState(false);
  const [quickFlashcardFront, setQuickFlashcardFront] = useState('');

  const cardRef = useRef(fullCard);
  cardRef.current = fullCard;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs para o teclado do TipTap acessar os menus flutuantes sem closure obsoleta
  const triggerMenuRef = useRef<FloatingTriggerMenu | null>(null);
  triggerMenuRef.current = triggerMenu;
  const triggerIndexRef = useRef(0);
  triggerIndexRef.current = triggerIndex;

  // Itens filtrados do Slash Command
  const filteredSlashItems = useMemo(() => {
    if (triggerMenu?.kind !== 'slash') return [];
    const q = triggerMenu.query.toLowerCase();
    return SLASH_COMMANDS.filter(
      (item) =>
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.keywords.includes(q) ||
        item.id.includes(q)
    );
  }, [triggerMenu]);

  // Itens filtrados do Autocomplete [[
  const filteredWikiItems = useMemo(() => {
    if (triggerMenu?.kind !== 'wikilink') return [];
    const q = triggerMenu.query.toLowerCase();
    return Object.values(cardsById)
      .filter((c) => c.id !== fullCard.meta.id)
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [triggerMenu, cardsById, fullCard.meta.id]);

  const filteredSlashRef = useRef(filteredSlashItems);
  filteredSlashRef.current = filteredSlashItems;
  const filteredWikiRef = useRef(filteredWikiItems);
  filteredWikiRef.current = filteredWikiItems;

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const executeTriggerItem = useCallback((idx: number) => {
    const ed = editorRef.current;
    const menu = triggerMenuRef.current;
    if (!ed || !menu) return;

    if (menu.kind === 'slash') {
      const item = filteredSlashRef.current[idx];
      if (!item) return;
      ed.chain().focus().deleteRange(menu.range).run();
      item.run(ed);
      setTriggerMenu(null);
    } else if (menu.kind === 'wikilink') {
      const target = filteredWikiRef.current[idx];
      if (!target) return;
      ed.chain()
        .focus()
        .deleteRange(menu.range)
        .insertContent({
          type: 'wikiLink',
          attrs: { cardId: target.id, label: target.title },
        })
        .insertContent(' ')
        .run();
      setTriggerMenu(null);
    }
  }, []);

  const executeTriggerRef = useRef(executeTriggerItem);
  executeTriggerRef.current = executeTriggerItem;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false, horizontalRule: false }),
      CustomHorizontalRule,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
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
        placeholder:
          'Digite "/" para blocos rápidos, "[[" para conectar outro card, ou Ctrl+V para colar um print...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'min-h-[300px] focus:outline-none',
      },
      // Navegação por teclado nos menus / e [[
      handleKeyDown: (_view, event) => {
        const menu = triggerMenuRef.current;
        if (!menu) return false;
        const count =
          menu.kind === 'slash'
            ? filteredSlashRef.current.length
            : filteredWikiRef.current.length;

        if (event.key === 'Escape') {
          event.preventDefault();
          setTriggerMenu(null);
          return true;
        }
        if (count === 0) return false;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setTriggerIndex((i) => (i + 1) % count);
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setTriggerIndex((i) => (i - 1 + count) % count);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          executeTriggerRef.current(triggerIndexRef.current);
          return true;
        }
        return false;
      },
      // Smart Paste: Ctrl+V de print/imagem comprime em WebP e insere direto no cursor
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (!file) continue;
            event.preventDefault();
            compressImageToDataUrl(file).then((dataUrl) => {
              editorRef.current?.chain().focus().setImage({ src: dataUrl }).run();
              addToast({ message: 'Imagem colada e otimizada no card', variant: 'success' }, 2600);
            });
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const current = cardRef.current;
      if (!current) return;

      // Detecta gatilhos [[ e / no cursor
      const { $from, empty } = ed.state.selection;
      if (empty) {
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\0');
        const wikiMatch = textBefore.match(/\[\[([^\[\]]*)$/);
        const slashMatch = !wikiMatch ? textBefore.match(/(?:^|\s)\/([a-zA-Z0-9À-ÿ]*)$/) : null;

        if (wikiMatch || slashMatch) {
          const coords = ed.view.coordsAtPos($from.pos);
          const matchLen = wikiMatch ? wikiMatch[0].length : slashMatch![1].length + 1;
          const menuWidth = 280;
          setTriggerMenu({
            kind: wikiMatch ? 'wikilink' : 'slash',
            query: wikiMatch ? wikiMatch[1] : slashMatch![1],
            range: { from: $from.pos - matchLen, to: $from.pos },
            top: Math.min(window.innerHeight - 280, coords.bottom + 8),
            left: Math.max(16, Math.min(window.innerWidth - menuWidth - 16, coords.left)),
          });
          setTriggerIndex(0);
        } else {
          setTriggerMenu(null);
        }
      } else {
        setTriggerMenu(null);
      }

      // Salvamento com debounce suave
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const latest = cardRef.current;
        if (!latest || latest.meta.id !== current.meta.id) return;

        const json = ed.getJSON() as Record<string, unknown>;
        const plainText = ed.getText();
        const outgoingLinkIds = extractOutgoingLinkIds(json);

        saveCardContent(
          latest.meta.id,
          { ...latest.content, tiptapJson: json, plainText, updatedAt: Date.now() },
          plainText
        );

        if (latest.meta.outgoingLinkIds.join(',') !== outgoingLinkIds.join(',')) {
          updateCardMeta(latest.meta.id, { outgoingLinkIds });
        }
      }, 260);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to, empty } = ed.state.selection;
      if (empty || from === to) {
        setBubbleMenu(null);
        setQuickFlashcardMode(false);
        return;
      }

      const selectedText = ed.state.doc.textBetween(from, to, '\n').trim();
      if (!selectedText) {
        setBubbleMenu(null);
        return;
      }

      const startCoords = ed.view.coordsAtPos(from);
      const endCoords = ed.view.coordsAtPos(to);
      const centerX = (startCoords.left + endCoords.right) / 2;
      const bubbleWidth = 370;

      setBubbleMenu({
        top: Math.max(62, startCoords.top - 52),
        left: Math.max(16, Math.min(window.innerWidth - bubbleWidth - 16, centerX - bubbleWidth / 2)),
        from,
        to,
        selectedText,
      });
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (editor && fullCard) {
      editor.commands.setContent(fullCard.content.tiptapJson, { emitUpdate: false });
      setOpenMenu(null);
      setTriggerMenu(null);
      setBubbleMenu(null);
      setQuickFlashcardMode(false);
    }
  }, [fullCard.meta.id, editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Hierarquia em cascata
  const disciplines = useMemo(() => hierarchy.filter((h) => h.level === 'discipline'), [hierarchy]);
  const subjects = useMemo(
    () => hierarchy.filter((h) => h.level === 'subject' && h.parentId === fullCard.meta.disciplineId),
    [hierarchy, fullCard.meta.disciplineId]
  );
  const subsubjects = useMemo(
    () => hierarchy.filter((h) => h.level === 'subsubject' && h.parentId === fullCard.meta.subjectId),
    [hierarchy, fullCard.meta.subjectId]
  );
  const topics = useMemo(
    () => hierarchy.filter((h) => h.level === 'topic' && h.parentId === fullCard.meta.subsubjectId),
    [hierarchy, fullCard.meta.subsubjectId]
  );

  const otherCards = useMemo(() => {
    const q = wikiQuery.trim().toLowerCase();
    return Object.values(cardsById)
      .filter((c) => c.id !== fullCard.meta.id)
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .slice(0, 12);
  }, [cardsById, fullCard.meta.id, wikiQuery]);

  const backlinks = useMemo(
    () =>
      Object.values(cardsById).filter((c) => c.outgoingLinkIds?.includes(fullCard.meta.id)),
    [cardsById, fullCard.meta.id]
  );

  // Ações rápidas do Bubble Menu
  const handleCreateQuickFlashcard = () => {
    if (!bubbleMenu || !quickFlashcardFront.trim()) return;
    const fc: EmbeddedFlashcard = {
      id: `fc-${crypto.randomUUID()}`,
      front: quickFlashcardFront.trim(),
      back: bubbleMenu.selectedText,
      easeFactor: 2.5,
      intervalDays: 1,
      nextReviewAt: Date.now(),
    };
    saveCardContent(
      fullCard.meta.id,
      {
        ...fullCard.content,
        flashcards: [...fullCard.content.flashcards, fc],
        updatedAt: Date.now(),
      },
      fullCard.content.plainText
    );
    setQuickFlashcardFront('');
    setQuickFlashcardMode(false);
    setBubbleMenu(null);
    addToast({ message: 'Flashcard criado a partir do trecho!', variant: 'success' });
  };

  const handleWrapCloze = () => {
    if (!bubbleMenu || !editor) return;
    const { from, to, selectedText } = bubbleMenu;
    const isAlreadyCloze = selectedText.startsWith('{{') && selectedText.endsWith('}}');
    const replacement = isAlreadyCloze ? selectedText.slice(2, -2) : `{{${selectedText}}}`;
    editor.chain().focus().insertContentAt({ from, to }, replacement).run();
    setBubbleMenu(null);
    addToast({
      message: isAlreadyCloze
        ? 'Lacuna removida'
        : 'Lacuna {{...}} criada — entrará na sessão de revisão!',
      variant: 'success',
    }, 2800);
  };

  const handleExtractToNewCard = async () => {
    if (!bubbleMenu || !editor) return;
    const { from, to, selectedText } = bubbleMenu;
    const extracted = await extractSelectionToCard({
      sourceCardId: fullCard.meta.id,
      selectedText,
    });
    if (!extracted) return;

    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent({
        type: 'wikiLink',
        attrs: { cardId: extracted.cardId, label: extracted.title },
      })
      .run();

    setBubbleMenu(null);
    addToast({
      message: `Card "${extracted.title}" extraído e conectado`,
      variant: 'success',
      action: {
        label: 'Abrir ao lado',
        onClick: () => openSecondaryCard(extracted.cardId),
      },
    });
  };

  const handleAddTag = () => {
    const clean = newTag
      .trim()
      .toLowerCase()
      .replace(/^#+/, '')
      .replace(/\s+/g, '-');
    if (!clean || fullCard.meta.tags.includes(clean)) {
      setNewTag('');
      return;
    }
    updateCardMeta(fullCard.meta.id, { tags: [...fullCard.meta.tags, clean] });
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    updateCardMeta(fullCard.meta.id, {
      tags: fullCard.meta.tags.filter((t) => t !== tag),
    });
  };

  const handleAddFlashcard = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    const fc: EmbeddedFlashcard = {
      id: `fc-${crypto.randomUUID()}`,
      front: newFront.trim(),
      back: newBack.trim(),
      easeFactor: 2.5,
      intervalDays: 1,
      nextReviewAt: Date.now(),
    };
    saveCardContent(
      fullCard.meta.id,
      {
        ...fullCard.content,
        flashcards: [...fullCard.content.flashcards, fc],
        updatedAt: Date.now(),
      },
      fullCard.content.plainText
    );
    setNewFront('');
    setNewBack('');
  };

  const handleDeleteFlashcard = (fcId: string) => {
    saveCardContent(
      fullCard.meta.id,
      {
        ...fullCard.content,
        flashcards: fullCard.content.flashcards.filter((f) => f.id !== fcId),
        updatedAt: Date.now(),
      },
      fullCard.content.plainText
    );
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    e.target.value = '';

    if (file.type.startsWith('image/') && editor) {
      const dataUrl = await compressImageToDataUrl(file);
      editor.chain().focus().setImage({ src: dataUrl }).run();
      return;
    }

    const blobId = `blob-${crypto.randomUUID()}`;
    await getKnowledgeRepository().saveBlob(blobId, file);

    const type: LocalAttachment['type'] = file.type.startsWith('audio/') ? 'audio' : 'pdf';
    const newAtt: LocalAttachment = {
      id: `att-${crypto.randomUUID()}`,
      type,
      name: file.name,
      mimeType: file.type,
      blobId,
      sizeBytes: file.size,
    };

    saveCardContent(
      fullCard.meta.id,
      {
        ...fullCard.content,
        attachments: [...fullCard.content.attachments, newAtt],
        updatedAt: Date.now(),
      },
      fullCard.content.plainText
    );
  };

  const handleAddAttachmentFromManager = (attachment: LocalAttachment) => {
    saveCardContent(
      fullCard.meta.id,
      {
        ...fullCard.content,
        attachments: [...fullCard.content.attachments, attachment],
        updatedAt: Date.now(),
      },
      fullCard.content.plainText
    );
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    saveCardContent(
      fullCard.meta.id,
      {
        ...fullCard.content,
        attachments: fullCard.content.attachments.filter((a) => a.id !== attachmentId),
        updatedAt: Date.now(),
      },
      fullCard.content.plainText
    );
  };

  const cycleImportance = () => {
    const order: ImportanceLevel[] = ['normal', 'high', 'critical'];
    const idx = order.indexOf(fullCard.meta.importance);
    updateCardMeta(fullCard.meta.id, { importance: order[(idx + 1) % order.length] });
  };

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col bg-[#13161C]/98">
      {/* TOPBAR DO PAINEL */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-1">
          {slot === 'secondary' && (
            <span className="mr-1.5 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
              LADO A LADO
            </span>
          )}

          <button
            onClick={() => updateCardMeta(fullCard.meta.id, { isPinned: !fullCard.meta.isPinned })}
            className={`rounded-lg p-1.5 transition ${
              fullCard.meta.isPinned ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-800'
            }`}
            title="Fixar permanentemente"
          >
            <Pin className="h-4 w-4" />
          </button>

          <button
            onClick={() => updateCardMeta(fullCard.meta.id, { isFavorite: !fullCard.meta.isFavorite })}
            className={`rounded-lg p-1.5 transition ${
              fullCard.meta.isFavorite ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:bg-zinc-800'
            }`}
            title="Favoritar"
          >
            <Star className="h-4 w-4" />
          </button>

          <button
            onClick={() => setIsNotebookModalOpen(true)}
            className={`rounded-lg p-1.5 transition ${
              (fullCard.meta.notebookIds?.length ?? 0) > 0
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
            title="Vincular a Meus Cadernos"
          >
            <Bookmark className="h-4 w-4" />
          </button>

          <button
            onClick={cycleImportance}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
              fullCard.meta.importance === 'critical'
                ? 'bg-rose-500/20 text-rose-300'
                : fullCard.meta.importance === 'high'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
            title="Alternar importância"
          >
            <Flame className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {fullCard.meta.importance === 'critical'
                ? 'Crítico'
                : fullCard.meta.importance === 'high'
                ? 'Importante'
                : 'Normal'}
            </span>
          </button>

          <div className="mx-1 h-4 w-px bg-zinc-800" />

          <div className="hidden items-center gap-1 sm:flex">
            {CARD_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => updateCardMeta(fullCard.meta.id, { color: c.id })}
                title={`Cor do card: ${c.label}`}
                className={`h-3.5 w-3.5 rounded-full border-2 transition hover:scale-110 ${
                  fullCard.meta.color === c.id ? 'scale-110 border-white' : 'border-transparent opacity-65'
                }`}
                style={{ backgroundColor: c.dot }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Botão Split View (abrir segundo card lado a lado) */}
          {slot === 'primary' && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setWikiQuery('');
                  setOpenMenu(openMenu === 'splitpicker' ? null : 'splitpicker');
                }}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                  isSplitActive
                    ? 'bg-indigo-600/25 text-indigo-300'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
                title="Abrir outro card lado a lado (Split View)"
              >
                <Columns2 className="h-4 w-4" />
                <span className="hidden sm:inline">Dividir</span>
              </button>

              {openMenu === 'splitpicker' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-zinc-800 bg-[#161920] p-2 shadow-2xl"
                >
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Abrir ao lado (Split View)
                  </p>
                  <input
                    autoFocus
                    value={wikiQuery}
                    onChange={(e) => setWikiQuery(e.target.value)}
                    placeholder="Buscar card..."
                    className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="max-h-52 space-y-0.5 overflow-y-auto">
                    {otherCards.length === 0 ? (
                      <p className="py-3 text-center text-[11px] text-zinc-500">
                        Nenhum outro card disponível.
                      </p>
                    ) : (
                      otherCards.map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => {
                            openSecondaryCard(target.id);
                            setOpenMenu(null);
                          }}
                          className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-indigo-600/20 hover:text-indigo-200"
                        >
                          {target.emoji ? `${target.emoji} ` : ''}
                          {target.title}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {slot === 'primary' && !isSplitActive && onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              title={isExpanded ? 'Reduzir painel' : 'Expandir para modo foco'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}

          <button
            onClick={() => {
              const snapshotFull = fullCard;
              const state = useKnowledgeStore.getState();
              const linkedNodes = state.canvasNodes.filter((n) => n.cardId === snapshotFull.meta.id);
              const nodeIds = new Set(linkedNodes.map((n) => n.id));
              const linkedEdges = state.canvasEdges.filter(
                (e) => nodeIds.has(e.sourceNodeId) || nodeIds.has(e.targetNodeId)
              );

              openConfirm({
                title: 'Excluir Knowledge Card?',
                description: `"${snapshotFull.meta.title}" será removido do canvas e da biblioteca. Você poderá desfazer logo em seguida.`,
                confirmLabel: 'Excluir',
                variant: 'danger',
                onConfirm: async () => {
                  await deleteCard(snapshotFull.meta.id);
                  addToast({
                    message: 'Knowledge Card excluído',
                    action: {
                      label: 'Desfazer',
                      onClick: () => restoreCardBundle(snapshotFull, linkedNodes, linkedEdges),
                    },
                  });
                },
              });
            }}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400"
            title="Excluir Card"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* CORPO SCROLLÁVEL */}
      <div
        className="flex-1 overflow-y-auto px-6 py-5"
        onClick={() => {
          if (openMenu) setOpenMenu(null);
          if (triggerMenu) setTriggerMenu(null);
        }}
      >
        {/* Classificação Hierárquica 4 Níveis */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px]">
          <FolderTree className="mr-0.5 h-3.5 w-3.5 text-indigo-400" />
          <select
            value={fullCard.meta.disciplineId || ''}
            onChange={(e) =>
              updateCardMeta(fullCard.meta.id, {
                disciplineId: e.target.value,
                subjectId: '',
                subsubjectId: null,
                topicId: null,
              })
            }
            className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-zinc-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Disciplina...</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>

          {subjects.length > 0 && (
            <>
              <span className="text-zinc-600">/</span>
              <select
                value={fullCard.meta.subjectId || ''}
                onChange={(e) =>
                  updateCardMeta(fullCard.meta.id, {
                    subjectId: e.target.value,
                    subsubjectId: null,
                    topicId: null,
                  })
                }
                className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Assunto...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </>
          )}

          {subsubjects.length > 0 && (
            <>
              <span className="text-zinc-600">/</span>
              <select
                value={fullCard.meta.subsubjectId || ''}
                onChange={(e) =>
                  updateCardMeta(fullCard.meta.id, {
                    subsubjectId: e.target.value || null,
                    topicId: null,
                  })
                }
                className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Subassunto...</option>
                {subsubjects.map((ss) => (
                  <option key={ss.id} value={ss.id}>
                    {ss.title}
                  </option>
                ))}
              </select>
            </>
          )}

          {topics.length > 0 && (
            <>
              <span className="text-zinc-600">/</span>
              <select
                value={fullCard.meta.topicId || ''}
                onChange={(e) =>
                  updateCardMeta(fullCard.meta.id, { topicId: e.target.value || null })
                }
                className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1 text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Tópico...</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Título */}
        <input
          value={fullCard.meta.title}
          onChange={(e) => updateCardMeta(fullCard.meta.id, { title: e.target.value })}
          className="mb-3 w-full bg-transparent text-2xl font-bold tracking-tight text-zinc-100 focus:outline-none"
          placeholder="Título do Knowledge Card"
        />

        {/* Tags */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-zinc-500" />
          {fullCard.meta.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-300"
            >
              #{tag}
              <button onClick={() => handleRemoveTag(tag)} className="text-zinc-500 hover:text-rose-400">
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
            placeholder="+ tag (Enter)"
            className="w-28 rounded-md bg-transparent px-1.5 py-0.5 text-[11px] text-zinc-300 placeholder:text-zinc-600 focus:bg-zinc-900 focus:outline-none"
          />
        </div>

        {/* Observação rápida / Pegadinha */}
        <input
          value={fullCard.meta.notes}
          onChange={(e) => updateCardMeta(fullCard.meta.id, { notes: e.target.value })}
          className="mb-4 w-full rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-3.5 py-2 text-xs text-amber-200 placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none"
          placeholder="Observação rápida / pegadinha de banca / mnemônico..."
        />

        {/* TOOLBAR RICA FIXA */}
        {editor && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800/90 bg-[#181C24]/95 p-1.5 shadow-lg backdrop-blur-md"
          >
            {[1, 2, 3].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: lvl as 1 | 2 | 3 }).run()}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                  editor.isActive('heading', { level: lvl })
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
              >
                H{lvl}
              </button>
            ))}

            <div className="mx-0.5 h-4 w-px bg-zinc-800" />

            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`rounded-lg p-1.5 ${editor.isActive('bold') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Negrito"><Bold className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`rounded-lg p-1.5 ${editor.isActive('italic') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Itálico"><Italic className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`rounded-lg p-1.5 ${editor.isActive('underline') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Sublinhado"><UnderlineIcon className="h-3.5 w-3.5" /></button>

            <div className="relative">
              <button type="button" onClick={() => setOpenMenu(openMenu === 'color' ? null : 'color')} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800" title="Cor do texto">
                <Palette className="h-3.5 w-3.5" />
              </button>
              {openMenu === 'color' && (
                <div className="absolute left-0 top-full z-30 mt-2 flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#161920] p-2 shadow-2xl">
                  {TEXT_COLORS.map((hex) => (
                    <button key={hex} type="button" onClick={() => { editor.chain().focus().setColor(hex).run(); setOpenMenu(null); }} className="h-4 w-4 rounded-full border border-zinc-700 hover:scale-125" style={{ backgroundColor: hex }} />
                  ))}
                  <button type="button" onClick={() => { editor.chain().focus().unsetColor().run(); setOpenMenu(null); }} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">Reset</button>
                </div>
              )}
            </div>

            <div className="relative">
              <button type="button" onClick={() => setOpenMenu(openMenu === 'highlight' ? null : 'highlight')} className={`rounded-lg p-1.5 ${editor.isActive('highlight') ? 'bg-amber-500/20 text-amber-300' : 'text-amber-300 hover:bg-zinc-800'}`} title="Marca-texto">
                <Highlighter className="h-3.5 w-3.5" />
              </button>
              {openMenu === 'highlight' && (
                <div className="absolute left-0 top-full z-30 mt-2 flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#161920] p-2 shadow-2xl">
                  {HIGHLIGHT_COLORS.map((hex) => (
                    <button key={hex} type="button" onClick={() => { editor.chain().focus().toggleHighlight({ color: hex }).run(); setOpenMenu(null); }} className="h-4 w-4 rounded border border-zinc-700 hover:scale-125" style={{ backgroundColor: hex }} />
                  ))}
                  <button type="button" onClick={() => { editor.chain().focus().unsetHighlight().run(); setOpenMenu(null); }} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">Limpar</button>
                </div>
              )}
            </div>

            <div className="mx-0.5 h-4 w-px bg-zinc-800" />

            <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><AlignLeft className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><AlignCenter className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"><AlignRight className="h-3.5 w-3.5" /></button>

            <div className="mx-0.5 h-4 w-px bg-zinc-800" />

            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`rounded-lg p-1.5 ${editor.isActive('bulletList') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}><List className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`rounded-lg p-1.5 ${editor.isActive('orderedList') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}><ListOrdered className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={`rounded-lg p-1.5 ${editor.isActive('taskList') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}><CheckSquare className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`rounded-lg p-1.5 ${editor.isActive('blockquote') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}><Quote className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`rounded-lg p-1.5 ${editor.isActive('codeBlock') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}><Code2 className="h-3.5 w-3.5" /></button>

            <div className="relative">
              <button type="button" onClick={() => setOpenMenu(openMenu === 'table' ? null : 'table')} className={`rounded-lg p-1.5 ${editor.isActive('table') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Tabela">
                <TableIcon className="h-3.5 w-3.5" />
              </button>
              {openMenu === 'table' && (
                <div className="absolute left-0 top-full z-30 mt-2 flex w-48 flex-col gap-0.5 rounded-xl border border-zinc-800 bg-[#161920] p-1.5 text-xs shadow-2xl">
                  <button type="button" onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left font-medium text-indigo-300 hover:bg-zinc-800">Inserir Tabela (3×3)</button>
                  <button type="button" onClick={() => { editor.chain().focus().addColumnAfter().run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left text-zinc-300 hover:bg-zinc-800">+ Coluna à direita</button>
                  <button type="button" onClick={() => { editor.chain().focus().addRowAfter().run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left text-zinc-300 hover:bg-zinc-800">+ Linha abaixo</button>
                  <button type="button" onClick={() => { editor.chain().focus().deleteColumn().run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left text-zinc-400 hover:bg-zinc-800">- Remover coluna</button>
                  <button type="button" onClick={() => { editor.chain().focus().deleteRow().run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left text-zinc-400 hover:bg-zinc-800">- Remover linha</button>
                  <div className="my-1 h-px bg-zinc-800" />
                  <button type="button" onClick={() => { editor.chain().focus().deleteTable().run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left text-rose-400 hover:bg-rose-500/15">Excluir tabela</button>
                </div>
              )}
            </div>

            <div className="relative">
              <button type="button" onClick={() => setOpenMenu(openMenu === 'hr' ? null : 'hr')} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800" title="Divisória">
                <Minus className="h-3.5 w-3.5" />
              </button>
              {openMenu === 'hr' && (
                <div className="absolute left-0 top-full z-30 mt-2 flex w-40 flex-col gap-1 rounded-xl border border-zinc-800 bg-[#161920] p-1.5 text-xs shadow-2xl">
                  <button type="button" onClick={() => { editor.chain().focus().insertContent({ type: 'horizontalRule', attrs: { class: 'kc-hr-solid' } }).run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left text-zinc-200 hover:bg-zinc-800">Linha Contínua</button>
                  <button type="button" onClick={() => { editor.chain().focus().insertContent({ type: 'horizontalRule', attrs: { class: 'kc-hr-dashed' } }).run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left text-zinc-200 hover:bg-zinc-800">Linha Tracejada</button>
                </div>
              )}
            </div>

            <div className="mx-0.5 h-4 w-px bg-zinc-800" />

            <button type="button" onClick={() => editor.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run()} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-indigo-300 hover:bg-indigo-500/15" title="Fórmula KaTeX">
              <Sigma className="h-3.5 w-3.5" /> Fórmula
            </button>
            <button type="button" onClick={() => editor.chain().focus().insertContent({ type: 'mermaidBlock' }).run()} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/15" title="Diagrama Mermaid">
              <GitFork className="h-3.5 w-3.5" /> Diagrama
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setWikiQuery('');
                  setOpenMenu(openMenu === 'wikilink' ? null : 'wikilink');
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-500/15"
              >
                <Link2 className="h-3.5 w-3.5" /> [[Link]]
              </button>
              {openMenu === 'wikilink' && (
                <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-zinc-800 bg-[#161920] p-2 shadow-2xl">
                  <input
                    autoFocus
                    value={wikiQuery}
                    onChange={(e) => setWikiQuery(e.target.value)}
                    placeholder="Buscar card para conectar..."
                    className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="max-h-48 space-y-0.5 overflow-y-auto">
                    {otherCards.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => {
                          editor.chain().focus().insertContent({ type: 'wikiLink', attrs: { cardId: target.id, label: target.title } }).run();
                          setOpenMenu(null);
                        }}
                        className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs text-zinc-200 hover:bg-indigo-600/20 hover:text-indigo-200"
                      >
                        {target.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800">
              <Paperclip className="h-3.5 w-3.5" /> Mídia
              <input type="file" accept="image/*,application/pdf,audio/*" className="hidden" onChange={handleAttachFile} />
            </label>
          </div>
        )}

        {/* ÁREA DE ESCRITA */}
        <EditorContent editor={editor} />

        {/* ANEXOS LOCAIS (PDF / ÁUDIO / VOZ) */}
        <AttachmentManager
          attachments={fullCard.content.attachments}
          onAddAttachment={handleAddAttachmentFromManager}
          onRemoveAttachment={handleRemoveAttachment}
        />

        {/* FLASHCARDS EMBUTIDOS */}
        <div className="mt-7 border-t border-zinc-800/80 pt-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
            <Brain className="h-4 w-4" /> Flashcards Embutidos ({fullCard.content.flashcards.length})
          </div>

          <div className="mb-3 space-y-2">
            {fullCard.content.flashcards.map((fc) => {
              const flipped = !!flippedIds[fc.id];
              return (
                <div
                  key={fc.id}
                  onClick={() => setFlippedIds((p) => ({ ...p, [fc.id]: !p[fc.id] }))}
                  className="group relative cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/70 p-3.5 transition hover:border-indigo-500/40"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFlashcard(fc.id);
                    }}
                    className="absolute right-2.5 top-2.5 rounded p-1 text-zinc-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                    title="Remover flashcard"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {flipped ? 'Resposta (clique para ocultar)' : 'Pergunta (clique para revelar)'}
                  </p>
                  <p className="mt-1 pr-6 text-sm text-zinc-100">{flipped ? fc.back : fc.front}</p>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
            <input
              value={newFront}
              onChange={(e) => setNewFront(e.target.value)}
              placeholder="Frente (Pergunta de revisão ativa)..."
              className="w-full rounded-lg bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
            />
            <input
              value={newBack}
              onChange={(e) => setNewBack(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFlashcard();
              }}
              placeholder="Verso (Resposta objetiva)..."
              className="w-full rounded-lg bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddFlashcard}
              className="flex items-center gap-1 rounded-lg bg-indigo-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Flashcard
            </button>
          </div>
        </div>

        {/* BACKLINKS */}
        {backlinks.length > 0 && (
          <div className="mt-7 border-t border-zinc-800/80 pt-5">
            <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Mencionado em ({backlinks.length})
            </h4>
            <div className="space-y-1.5">
              {backlinks.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-xs text-zinc-200"
                >
                  <button
                    type="button"
                    onClick={() => openCard(source.id)}
                    className="min-w-0 flex-1 truncate text-left font-medium hover:text-indigo-300"
                  >
                    {source.title}
                  </button>
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openSecondaryCard(source.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-indigo-300"
                      title="Abrir lado a lado"
                    >
                      Split
                    </button>
                    <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MENU FLUTUANTE NO CURSOR: SLASH COMMANDS (/) E AUTOCOMPLETE ([[) */}
      {triggerMenu && (
        <div
          style={{ top: triggerMenu.top, left: triggerMenu.left }}
          onMouseDown={(e) => e.preventDefault()}
          className="fixed z-[90] w-[280px] overflow-hidden rounded-xl border border-zinc-700/90 bg-[#161920]/98 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-1 flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span>{triggerMenu.kind === 'slash' ? 'Inserir Bloco (/)' : 'Conectar Card ([[)'}</span>
            <span>↑↓ Enter</span>
          </div>

          {triggerMenu.kind === 'slash' ? (
            filteredSlashItems.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-zinc-500">Nenhum comando encontrado</p>
            ) : (
              <div className="max-h-64 space-y-0.5 overflow-y-auto">
                {filteredSlashItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => executeTriggerItem(idx)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                        idx === triggerIndex
                          ? 'bg-indigo-600/25 text-indigo-100'
                          : 'text-zinc-300 hover:bg-zinc-800/80'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-indigo-400" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{item.label}</p>
                        <p className="truncate text-[10px] text-zinc-500">{item.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : filteredWikiItems.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-zinc-500">Nenhum card encontrado</p>
          ) : (
            <div className="max-h-60 space-y-0.5 overflow-y-auto">
              {filteredWikiItems.map((target, idx) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => executeTriggerItem(idx)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                    idx === triggerIndex
                      ? 'bg-indigo-600/25 text-indigo-100'
                      : 'text-zinc-300 hover:bg-zinc-800/80'
                  }`}
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span className="truncate font-medium">{target.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUBBLE MENU CONTEXTUAL AO SELECIONAR TEXTO */}
      {bubbleMenu && editor && !triggerMenu && (
        <div
          style={{ top: bubbleMenu.top, left: bubbleMenu.left }}
          onMouseDown={(e) => {
            // Permite clicar no input de flashcard sem perder foco
            if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault();
          }}
          className="fixed z-[85] rounded-xl border border-zinc-700/90 bg-[#161920]/98 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          {quickFlashcardMode ? (
            <div className="flex w-[360px] flex-col gap-2 p-1.5">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Novo Flashcard (Verso = texto selecionado)
                </span>
                <button
                  type="button"
                  onClick={() => setQuickFlashcardMode(false)}
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                autoFocus
                value={quickFlashcardFront}
                onChange={(e) => setQuickFlashcardFront(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateQuickFlashcard();
                  }
                  if (e.key === 'Escape') setQuickFlashcardMode(false);
                }}
                placeholder="Digite a pergunta e aperte Enter..."
                className="w-full rounded-lg border border-indigo-500/60 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-zinc-500">
                  Resp: &ldquo;{bubbleMenu.selectedText.slice(0, 48)}...&rdquo;
                </span>
                <button
                  type="button"
                  onClick={handleCreateQuickFlashcard}
                  className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500"
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`rounded-lg p-1.5 ${editor.isActive('bold') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
                title="Negrito"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#fde047' }).run()}
                className={`rounded-lg p-1.5 ${editor.isActive('highlight') ? 'bg-amber-500/25 text-amber-300' : 'text-amber-300 hover:bg-zinc-800'}`}
                title="Destacar"
              >
                <Highlighter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`rounded-lg p-1.5 ${editor.isActive('blockquote') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
                title="Citação"
              >
                <Quote className="h-3.5 w-3.5" />
              </button>

              <div className="mx-0.5 h-4 w-px bg-zinc-700" />

              <button
                type="button"
                onClick={handleWrapCloze}
                className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950"
                title="Criar lacuna de memorização {{...}} para revisão ativa"
              >
                <Braces className="h-3.5 w-3.5" /> Lacuna
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuickFlashcardFront('');
                  setQuickFlashcardMode(true);
                }}
                className="flex items-center gap-1 rounded-lg bg-indigo-600/20 px-2 py-1 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-600 hover:text-white"
                title="Transformar frase selecionada em Flashcard"
              >
                <Brain className="h-3.5 w-3.5" /> Virar Flashcard
              </button>

              <button
                type="button"
                onClick={handleExtractToNewCard}
                className="flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-600 hover:text-white"
                title="Extrair trecho para um novo card conectado no Canvas"
              >
                <Scissors className="h-3.5 w-3.5" /> Extrair Card
              </button>
            </div>
          )}
        </div>
      )}

      <NotebookPickerModal
        cardId={isNotebookModalOpen ? fullCard.meta.id : null}
        onClose={() => setIsNotebookModalOpen(false)}
      />
    </div>
  );
}