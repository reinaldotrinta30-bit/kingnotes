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
import { StudyUnderlineMark } from '../extensions/StudyUnderlineMark';
import { buildCardTitleRenderProps } from '@/domains/canvas/utils/cardTitleStyle';
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
  X,
  Brain,
  Maximize2,
  PanelRight,
  Columns2,
  Scissors,
  Heading1,
  Heading2,
  Sparkles,
  Braces,
  Save,
  CheckCircle2,
  SlidersHorizontal,
  EyeOff,
} from 'lucide-react';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import {
  CardTitleStyle,
  EmbeddedFlashcard,
  FullKnowledgeCard,
  LocalAttachment,
} from '../types';
import { hexToRgbaString } from '@/domains/canvas/utils/contrast';
import { DEFAULT_CARD_TYPOGRAPHY, resolveCardCallout, resolveCardTitleStyle } from '../utils/defaults';
import { getHierarchyBreadcrumb } from '../utils/hierarchyContext';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { MathBlock } from '../extensions/MathBlock';
import { MermaidBlock } from '../extensions/MermaidBlock';
import { WikiLinkNode, extractOutgoingLinkIds } from '../extensions/WikiLinkNode';
import { StudyTapeMark } from '../extensions/StudyTapeMark';
import { buildTypographyCssVars, setCardPreviewCache } from '@/domains/canvas/components/CardRichPreview';
import { CalloutBadge } from '@/domains/canvas/components/CalloutBadge';
import { StudyUnderlinePicker } from '@/domains/canvas/components/StudyUnderlinePicker';
import { NotebookPickerModal } from './NotebookPickerModal';
import { EditorInspectorPanel } from './EditorInspectorPanel';
import { StudyFontMark } from '../extensions/StudyFontMark';
import { StudyFontPicker } from '@/domains/canvas/components/StudyFontPicker';
import { getFontFamilyCss } from '@/domains/canvas/utils/studyFonts';
import { getTextEffectClass } from '@/domains/canvas/utils/studyFonts';

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
  isExpanded = true,
  onToggleExpand,
  onClose,
}: KnowledgeCardEditorPaneProps) {
  const {
    cardsById,
    hierarchy,
    openSecondaryCard,
    updateCardMeta,
    saveCardContent,
    extractSelectionToCard,
  } = useKnowledgeStore();
  const { theme, addToast, setHasUnsavedEditorChanges } = useUiStore();

  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [showInspector, setShowInspector] = useState(() => !isSplitActive && isExpanded);

  // Detecta se há largura confortável para acoplar a barra de formatação no cabeçalho superior
  const [isWideHeader, setIsWideHeader] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1200px)');
    const sync = () => setIsWideHeader(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const dockToolbarInHeader = isExpanded && !isSplitActive && isWideHeader && slot === 'primary';

  // Estado explícito de rascunho + indicador de alterações não salvas
  const [activeField, setActiveField] = useState<'title' | 'body'>('body');
  const [titleDraft, setTitleDraft] = useState(fullCard.meta.title);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number>(fullCard.meta.updatedAt);

  // Popovers da barra de formatação
  const [openMenu, setOpenMenu] = useState<
    null | 'table' | 'hr' | 'color' | 'highlight' | 'wikilink' | 'splitpicker'
  >(null);
  const [wikiQuery, setWikiQuery] = useState('');

  // Menus no cursor: / e [[
  const [triggerMenu, setTriggerMenu] = useState<FloatingTriggerMenu | null>(null);
  const [triggerIndex, setTriggerIndex] = useState(0);

  // Bubble Menu contextual
  const [bubbleMenu, setBubbleMenu] = useState<BubbleMenuState | null>(null);
  const [quickFlashcardMode, setQuickFlashcardMode] = useState(false);
  const [quickFlashcardFront, setQuickFlashcardFront] = useState('');

  const cardRef = useRef(fullCard);
  cardRef.current = fullCard;
  const titleDraftRef = useRef(titleDraft);
  titleDraftRef.current = titleDraft;
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerMenuRef = useRef<FloatingTriggerMenu | null>(null);
  triggerMenuRef.current = triggerMenu;
  const triggerIndexRef = useRef(0);
  triggerIndexRef.current = triggerIndex;

  useEffect(() => {
    if (isSplitActive) {
      setShowInspector(false);
    } else if (isExpanded) {
      setShowInspector(true);
    }
  }, [isSplitActive, isExpanded]);

  useEffect(() => {
    if (!isDirty) setTitleDraft(fullCard.meta.title);
  }, [fullCard.meta.title, isDirty]);

  useEffect(() => {
    if (slot === 'primary') {
      setHasUnsavedEditorChanges(isDirty);
    }
  }, [isDirty, slot, setHasUnsavedEditorChanges]);

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

  const commitSaveNow = useCallback(
    async (showToastFeedback = false) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      const ed = editorRef.current;
      const latest = cardRef.current;
      if (!ed || !latest) return;

      const json = ed.getJSON() as Record<string, unknown>;
      const plainText = ed.getText();
      const outgoingLinkIds = extractOutgoingLinkIds(json);
      const cleanTitle = titleDraftRef.current.trim() || 'Sem título';

      setCardPreviewCache(latest.meta.id, json);

      const metaPatch: Partial<FullKnowledgeCard['meta']> = {};
      if (cleanTitle !== latest.meta.title) metaPatch.title = cleanTitle;
      if (latest.meta.outgoingLinkIds.join(',') !== outgoingLinkIds.join(',')) {
        metaPatch.outgoingLinkIds = outgoingLinkIds;
      }

      await saveCardContent(
        latest.meta.id,
        { ...latest.content, tiptapJson: json, plainText, updatedAt: Date.now() },
        plainText
      );
      if (Object.keys(metaPatch).length > 0) {
        await updateCardMeta(latest.meta.id, metaPatch);
      }

      setIsDirty(false);
      setLastSavedAt(Date.now());
      if (showToastFeedback) {
        addToast({ message: 'Alterações salvas', variant: 'success' }, 1800);
      }
    },
    [saveCardContent, updateCardMeta, addToast]
  );

  const scheduleAutoSave = useCallback(() => {
    setIsDirty(true);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      commitSaveNow(false);
    }, 1800);
  }, [commitSaveNow]);

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
      StudyTapeMark,
      StudyUnderlineMark,
      StudyFontMark,
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
        placeholder:
          'Digite "/" para blocos rápidos, "[[" para conectar outro card, ou Ctrl+V para colar um print...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'kc-inline-prose min-h-[340px] focus:outline-none',
      },
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
    onFocus: () => {
      setActiveField('body');
    },
    onUpdate: ({ editor: ed }) => {
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

      scheduleAutoSave();
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
      const bubbleWidth = 430;

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
    const onSaveKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        commitSaveNow(true);
      }
    };
    window.addEventListener('keydown', onSaveKey);
    return () => window.removeEventListener('keydown', onSaveKey);
  }, [commitSaveNow]);

  useEffect(() => {
    if (editor && fullCard) {
      editor.commands.setContent(fullCard.content.tiptapJson, { emitUpdate: false });
      setTitleDraft(fullCard.meta.title);
      setIsDirty(false);
      setLastSavedAt(fullCard.meta.updatedAt);
      setOpenMenu(null);
      setTriggerMenu(null);
      setBubbleMenu(null);
      setQuickFlashcardMode(false);
    }
  }, [fullCard.meta.id, editor]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const otherCards = useMemo(() => {
    const q = wikiQuery.trim().toLowerCase();
    return Object.values(cardsById)
      .filter((c) => c.id !== fullCard.meta.id)
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .slice(0, 12);
  }, [cardsById, fullCard.meta.id, wikiQuery]);

  const breadcrumb = useMemo(() => {
    const targetId =
      fullCard.meta.topicId ||
      fullCard.meta.subsubjectId ||
      fullCard.meta.subjectId ||
      fullCard.meta.disciplineId ||
      null;
    return getHierarchyBreadcrumb(hierarchy, targetId);
  }, [hierarchy, fullCard.meta]);

  const typoStyle = buildTypographyCssVars(fullCard.meta.typography, DEFAULT_CARD_TYPOGRAPHY);
  const callout = resolveCardCallout(fullCard.meta);
  const titleStyle = resolveCardTitleStyle(fullCard.meta);
  const isEditingTitle = activeField === 'title';

  const patchTitleStyle = (patch: Partial<CardTitleStyle>) => {
    updateCardMeta(fullCard.meta.id, {
      titleStyle: {
        ...titleStyle,
        color: titleStyle.color || undefined,
        bgColor: titleStyle.bgColor || undefined,
        underlineColor: titleStyle.underlineColor || undefined,
        highlightColor: titleStyle.highlightColor || undefined,
        ...patch,
      },
    });
  };
  const titleProps = buildCardTitleRenderProps(titleStyle, {
    fontSizeOverride: Math.max(22, Math.round(titleStyle.fontSize * 1.45)),
  });

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
    addToast(
      {
        message: isAlreadyCloze
          ? 'Lacuna removida'
          : 'Lacuna {{...}} criada — entrará na sessão de revisão!',
        variant: 'success',
      },
      2800
    );
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

  // Barra de formatação inteligente: acopla no cabeçalho (modo ampliado) ou abaixo dele (Lateral / Split)
  const renderFormattingToolbar = (inHeader: boolean) => {
    if (!editor) return null;

    const iconBtn = (active = false) =>
      `rounded-lg ${inHeader ? 'p-1.5' : 'p-1.5'} transition ${
        active ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
      }`;

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={
          inHeader
            ? 'flex flex-nowrap items-center gap-0.5 rounded-xl border border-zinc-800/90 bg-[#181C24]/95 px-2 py-1 shadow-inner'
            : 'sticky top-0 z-20 mb-5 flex w-full flex-wrap items-center gap-0.5 rounded-xl border border-zinc-800/90 bg-[#181C24]/95 px-2 py-1.5 shadow-lg backdrop-blur-md'
        }
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

        <div className="mx-1 h-4 w-px shrink-0 bg-zinc-800" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (isEditingTitle) {
              patchTitleStyle({ fontWeight: titleStyle.fontWeight === 'bold' ? 'normal' : 'bold' });
            } else {
              editor.chain().focus().toggleBold().run();
            }
          }}
          className={iconBtn(isEditingTitle ? titleStyle.fontWeight === 'bold' : editor.isActive('bold'))}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (isEditingTitle) patchTitleStyle({ italic: !titleStyle.italic });
            else editor.chain().focus().toggleItalic().run();
          }}
          className={iconBtn(isEditingTitle ? titleStyle.italic : editor.isActive('italic'))}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (isEditingTitle) patchTitleStyle({ underline: !titleStyle.underline });
            else editor.chain().focus().toggleUnderline().run();
          }}
          className={iconBtn(isEditingTitle ? titleStyle.underline : editor.isActive('underline'))}
          title="Sublinhado (Ctrl+U)"
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
              patchTitleStyle({ underline: true, underlineStyle: variant, underlineColor: color })
            }
            onClearStyle={() =>
              patchTitleStyle({ underline: false, underlineStyle: 'solid', underlineColor: undefined })
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

        {/* Cor do texto */}
        <div className="relative" onMouseDown={(e) => e.preventDefault()}>
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'color' ? null : 'color')}
            className={iconBtn(openMenu === 'color')}
            title="Cor do texto"
          >
            <Palette className="h-3.5 w-3.5" />
          </button>
          {openMenu === 'color' && (
            <div className="absolute left-0 top-full z-50 mt-2 flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#161920] p-2 shadow-2xl">
              {TEXT_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    if (isEditingTitle) patchTitleStyle({ color: hex });
                    else editor.chain().focus().setColor(hex).run();
                    setOpenMenu(null);
                  }}
                  className="h-4 w-4 rounded-full border border-zinc-700 hover:scale-125"
                  style={{ backgroundColor: hex }}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  if (isEditingTitle) patchTitleStyle({ color: undefined });
                  else editor.chain().focus().unsetColor().run();
                  setOpenMenu(null);
                }}
                className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Marca-texto */}
        <div className="relative" onMouseDown={(e) => e.preventDefault()}>
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'highlight' ? null : 'highlight')}
            className={`rounded-lg p-1.5 transition ${
              (isEditingTitle ? Boolean(titleStyle.highlightColor) : editor.isActive('highlight'))
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-amber-300 hover:bg-zinc-800'
            }`}
            title="Marca-texto"
          >
            <Highlighter className="h-3.5 w-3.5" />
          </button>
          {openMenu === 'highlight' && (
            <div className="absolute left-0 top-full z-50 mt-2 flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#161920] p-2 shadow-2xl">
              {HIGHLIGHT_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    if (isEditingTitle) patchTitleStyle({ highlightColor: hexToRgbaString(hex, 0.36) });
                    else editor.chain().focus().toggleHighlight({ color: hex }).run();
                    setOpenMenu(null);
                  }}
                  className="h-4 w-4 rounded border border-zinc-700 hover:scale-125"
                  style={{ backgroundColor: hex }}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  if (isEditingTitle) patchTitleStyle({ highlightColor: undefined });
                  else editor.chain().focus().unsetHighlight().run();
                  setOpenMenu(null);
                }}
                className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300"
              >
                Limpar
              </button>
            </div>
          )}
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
          title="Fita de ocultação para memorização ativa"
        >
          <EyeOff className="h-3 w-3" />
          <span className="hidden 2xl:inline">Fita</span>
        </button>

        <div className="mx-1 h-4 w-px shrink-0 bg-zinc-800" />

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => isEditingTitle ? patchTitleStyle({ textAlign: 'left' }) : editor.chain().focus().setTextAlign('left').run()} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" title="Alinhar à esquerda"><AlignLeft className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => isEditingTitle ? patchTitleStyle({ textAlign: 'center' }) : editor.chain().focus().setTextAlign('center').run()} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" title="Centralizar"><AlignCenter className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => isEditingTitle ? patchTitleStyle({ textAlign: 'right' }) : editor.chain().focus().setTextAlign('right').run()} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" title="Alinhar à direita"><AlignRight className="h-3.5 w-3.5" /></button>

        <div className="mx-1 h-4 w-px shrink-0 bg-zinc-800" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={iconBtn(editor.isActive('bulletList'))} title="Lista com marcadores"><List className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={iconBtn(editor.isActive('orderedList'))} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={iconBtn(editor.isActive('taskList'))} title="Checklist"><CheckSquare className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={iconBtn(editor.isActive('blockquote'))} title="Citação / Lei Seca"><Quote className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={iconBtn(editor.isActive('codeBlock'))} title="Bloco de código"><Code2 className="h-3.5 w-3.5" /></button>

        {/* Tabela */}
        <div className="relative">
          <button type="button" onClick={() => setOpenMenu(openMenu === 'table' ? null : 'table')} className={iconBtn(editor.isActive('table'))} title="Tabela">
            <TableIcon className="h-3.5 w-3.5" />
          </button>
          {openMenu === 'table' && (
            <div className="absolute left-0 top-full z-50 mt-2 flex w-48 flex-col gap-0.5 rounded-xl border border-zinc-800 bg-[#161920] p-1.5 text-xs shadow-2xl">
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

        {/* Divisória */}
        <div className="relative">
          <button type="button" onClick={() => setOpenMenu(openMenu === 'hr' ? null : 'hr')} className={iconBtn(openMenu === 'hr')} title="Linha divisória">
            <Minus className="h-3.5 w-3.5" />
          </button>
          {openMenu === 'hr' && (
            <div className="absolute right-0 top-full z-50 mt-2 flex w-40 flex-col gap-1 rounded-xl border border-zinc-800 bg-[#161920] p-1.5 text-xs shadow-2xl">
              <button type="button" onClick={() => { editor.chain().focus().insertContent({ type: 'horizontalRule', attrs: { class: 'kc-hr-solid' } }).run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left text-zinc-200 hover:bg-zinc-800">Linha Contínua</button>
              <button type="button" onClick={() => { editor.chain().focus().insertContent({ type: 'horizontalRule', attrs: { class: 'kc-hr-dashed' } }).run(); setOpenMenu(null); }} className="rounded-lg px-2.5 py-1.5 text-left text-zinc-200 hover:bg-zinc-800">Linha Tracejada</button>
            </div>
          )}
        </div>

        <div className="mx-1 h-4 w-px shrink-0 bg-zinc-800" />

        {/* Ícones compactos: Fórmula, Diagrama, Link e Anexo (Clipe) */}
        <button
          type="button"
          onClick={() => editor.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run()}
          className="rounded-lg p-1.5 text-indigo-300 transition hover:bg-indigo-500/15"
          title="Inserir Fórmula Matemática (KaTeX)"
          aria-label="Inserir fórmula matemática"
        >
          <Sigma className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().insertContent({ type: 'mermaidBlock' }).run()}
          className="rounded-lg p-1.5 text-emerald-300 transition hover:bg-emerald-500/15"
          title="Inserir Diagrama / Fluxograma (Mermaid)"
          aria-label="Inserir diagrama"
        >
          <GitFork className="h-3.5 w-3.5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setWikiQuery('');
              setOpenMenu(openMenu === 'wikilink' ? null : 'wikilink');
            }}
            className="rounded-lg p-1.5 text-sky-300 transition hover:bg-sky-500/15"
            title="Conectar outro Card ([[Link]])"
            aria-label="Conectar outro card"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          {openMenu === 'wikilink' && (
            <div style={titleProps.wrapperStyle} className={`mb-3 w-full ${titleProps.wrapperClassName}`}>
              <input
                value={titleDraft}
                onFocus={() => setActiveField('title')}
                onChange={(e) => {
                  setTitleDraft(e.target.value);
                  scheduleAutoSave();
                }}
                style={titleProps.textStyle}
                className={`w-full bg-transparent leading-tight tracking-tight text-zinc-100 placeholder:text-zinc-600 focus:outline-none ${titleProps.textClassName}`}
                placeholder="Título do Knowledge Card"
              />
            </div>
          )}
        </div>

        <label
          className="flex cursor-pointer items-center justify-center rounded-lg p-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          title="Anexar imagem, PDF ou áudio"
          aria-label="Anexar mídia"
        >
          <Paperclip className="h-3.5 w-3.5" />
          <input type="file" accept="image/*,application/pdf,audio/*" className="hidden" onChange={handleAttachFile} />
        </label>
      </div>
    );
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#13161C]/98">
      {/* CABEÇALHO DO EDITOR AVANÇADO (ACOMODA A BARRA DE FORMATAÇÃO NO MODO AMPLIADO) */}
      <header className="relative z-30 flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-2.5">
        {/* Esquerda: Identificação compacta + Status de Salvamento */}
        <div
          className={`flex min-w-0 items-center gap-2 ${
            dockToolbarInHeader ? 'max-w-[190px] shrink-0' : 'flex-1'
          }`}
        >
          {slot === 'secondary' && (
            <span className="shrink-0 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
              LADO A LADO
            </span>
          )}
          {fullCard.meta.emoji && (
            <span className="shrink-0 text-base leading-none">{fullCard.meta.emoji}</span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-semibold text-zinc-100" title={titleDraft || 'Sem título'}>
                {titleDraft || 'Sem título'}
              </span>
              {isDirty ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className={dockToolbarInHeader ? 'hidden 2xl:inline' : ''}>Não salvo</span>
                </span>
              ) : (
                <span
                  className="inline-flex shrink-0 items-center gap-1 text-[10.5px] text-emerald-400/90"
                  title={`Salvo às ${new Date(lastSavedAt).toLocaleTimeString('pt-BR')}`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span className={dockToolbarInHeader ? 'hidden 2xl:inline' : 'hidden sm:inline'}>Salvo</span>
                </span>
              )}
            </div>
            {breadcrumb.length > 0 && !dockToolbarInHeader && (
              <p className="truncate text-[10.5px] text-zinc-500">
                {breadcrumb.map((b) => b.title).join(' › ')}
              </p>
            )}
          </div>
        </div>

        {/* Centro: Barra de Formatação acoplada no cabeçalho quando em Tela Ampliada */}
        {dockToolbarInHeader && (
          <div className="flex min-w-0 flex-1 items-center justify-center">
            {renderFormattingToolbar(true)}
          </div>
        )}

        {/* Direita: Salvar + Modos + Fechar */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => commitSaveNow(true)}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
              isDirty
                ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500'
                : 'border border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700 hover:text-white'
            }`}
            title="Salvar agora (Ctrl+S)"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Salvar</span>
          </button>

          {slot === 'primary' && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setWikiQuery('');
                  setOpenMenu(openMenu === 'splitpicker' ? null : 'splitpicker');
                }}
                className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-medium transition ${
                  isSplitActive
                    ? 'border-indigo-500/50 bg-indigo-600/20 text-indigo-200'
                    : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
                title="Abrir outro card lado a lado (Split View)"
              >
                <Columns2 className="h-3.5 w-3.5" />
                <span className={dockToolbarInHeader ? 'hidden 2xl:inline' : 'hidden md:inline'}>
                  Lado a Lado
                </span>
              </button>

              {openMenu === 'splitpicker' && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-zinc-800 bg-[#161920] p-2 shadow-2xl"
                >
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Abrir segundo card ao lado
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

          {slot === 'primary' && onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-[#0F1115] px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
              title={
                isExpanded
                  ? 'Alternar para painel lateral (ver o Canvas ao lado)'
                  : 'Alternar para tela ampliada'
              }
            >
              {isExpanded ? <PanelRight className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className={dockToolbarInHeader ? 'hidden 2xl:inline' : 'hidden xl:inline'}>
                {isExpanded ? 'Lateral' : 'Ampliar'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowInspector((v) => !v)}
            className={`rounded-xl border p-1.5 transition ${
              showInspector
                ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-100'
            }`}
            title={showInspector ? 'Ocultar painel de propriedades' : 'Mostrar painel de propriedades'}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-[#0F1115] px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200"
            title="Fechar editor (Esc)"
          >
            <X className="h-4 w-4" />
            <span className={dockToolbarInHeader ? 'hidden 2xl:inline' : 'hidden sm:inline'}>Fechar</span>
          </button>
        </div>
      </header>

      {/* CORPO EM DUAS COLUNAS RESPONSIVAS: CONTEÚDO + INSPETOR */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div
          className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-10"
          onClick={() => {
            if (openMenu) setOpenMenu(null);
            if (triggerMenu) setTriggerMenu(null);
          }}
        >
          <div className="mx-auto max-w-4xl">
            <input
              value={titleDraft}
              onChange={(e) => {
                setTitleDraft(e.target.value);
                scheduleAutoSave();
              }}
              style={{
                fontFamily: getFontFamilyCss(titleStyle.fontFamily),
                fontSize: `${Math.max(22, Math.round(titleStyle.fontSize * 1.45))}px`,
                color: titleStyle.color || undefined,
                textAlign: titleStyle.textAlign,
                fontStyle: titleStyle.italic ? 'italic' : 'normal',
                textDecoration: titleStyle.underline ? 'underline' : 'none',
                ['--kc-fx-color' as string]: titleStyle.effectColor,
                ['--kc-fx-start' as string]: titleStyle.color || '#f4f4f5',
              }}
              className={`mb-3 w-full bg-transparent font-bold leading-tight tracking-tight text-zinc-100 placeholder:text-zinc-600 focus:outline-none ${getTextEffectClass(
                titleStyle.textEffect
              )}`}
              placeholder="Título do Knowledge Card"
            />

            {callout.visible !== false && (callout.text ?? '').trim().length > 0 && (
              <CalloutBadge config={callout} theme={theme} className="mb-4" />
            )}

            {/* Nos modos Lateral, Lado a Lado ou telas menores, a barra fica logo abaixo do título em 1 linha limpa */}
            {!dockToolbarInHeader && renderFormattingToolbar(false)}

            <div style={typoStyle}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {showInspector && (
          <EditorInspectorPanel
            fullCard={fullCard}
            onOpenNotebookModal={() => setIsNotebookModalOpen(true)}
            onAddAttachment={handleAddAttachmentFromManager}
            onRemoveAttachment={handleRemoveAttachment}
            onCloseEditor={onClose}
          />
        )}
      </div>

      {/* MENU FLUTUANTE NO CURSOR: / E [[ */}
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
              <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`rounded-lg p-1.5 ${editor.isActive('bold') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Negrito"><Bold className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`rounded-lg p-1.5 ${editor.isActive('italic') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Itálico"><Italic className="h-3.5 w-3.5" /></button>
              <StudyUnderlinePicker editor={editor} />
              <button type="button" onClick={() => editor.chain().focus().toggleHighlight({ color: '#fde047' }).run()} className={`rounded-lg p-1.5 ${editor.isActive('highlight') ? 'bg-amber-500/25 text-amber-300' : 'text-amber-300 hover:bg-zinc-800'}`} title="Destacar"><Highlighter className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`rounded-lg p-1.5 ${editor.isActive('blockquote') ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`} title="Citação"><Quote className="h-3.5 w-3.5" /></button>

              <div className="mx-0.5 h-4 w-px bg-zinc-700" />

              <button
                type="button"
                onClick={handleWrapCloze}
                className="flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950"
                title="Criar lacuna {{...}}"
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
                title="Transformar frase em Flashcard"
              >
                <Brain className="h-3.5 w-3.5" /> Flashcard
              </button>

              <button
                type="button"
                onClick={handleExtractToNewCard}
                className="flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-600 hover:text-white"
                title="Extrair trecho para novo card conectado"
              >
                <Scissors className="h-3.5 w-3.5" /> Extrair
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