'use client';

import React, { useMemo, useState } from 'react';
import {
  Palette,
  Type,
  Sparkles,
  Brain,
  Link2,
  FolderTree,
  Sliders,
  Plus,
  Minus,
  RotateCcw,
  Eye,
  EyeOff,
  AlertTriangle,
  Wand2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Tag,
  Bookmark,
  Pin,
  Star,
  Flame,
  ArrowUpRight,
  Copy,
  FileType,
  Crosshair,
  Minimize2,
} from 'lucide-react';
import {
  CalloutEmphasis,
  CalloutPosition,
  CalloutPreset,
  CanvasNodePosition,
  CardCalloutConfig,
  EmbeddedFlashcard,
  FullKnowledgeCard,
  ImportanceLevel,
  KnowledgeCardMeta,
  LocalAttachment,
} from '../types';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import {
  DEFAULT_CALLOUT_CONFIG,
  DEFAULT_CARD_TYPOGRAPHY,
  TYPOGRAPHY_LIMITS,
  resolveCardCallout,
  resolveTypography,
} from '../utils/defaults';
import { CALLOUT_PRESETS, resolveCalloutVisualColors } from '@/domains/canvas/components/CalloutBadge';
import {
  MEETS_WCAG_AA,
  getContrastRatio,
  suggestAccessibleTextColor,
} from '@/domains/canvas/utils/contrast';
import { AttachmentManager } from './AttachmentManager';

type InspectorTab = 'style' | 'callout' | 'study' | 'relations';

const CARD_COLORS: Array<{ id: KnowledgeCardMeta['color']; label: string; dot: string }> = [
  { id: 'default', label: 'Neutro', dot: '#52525b' },
  { id: 'violet', label: 'Violeta', dot: '#8b5cf6' },
  { id: 'sky', label: 'Azul', dot: '#0ea5e9' },
  { id: 'emerald', label: 'Verde', dot: '#10b981' },
  { id: 'amber', label: 'Âmbar', dot: '#f59e0b' },
  { id: 'rose', label: 'Rosa', dot: '#f43f5e' },
];

const PAPER_STYLES: Array<{ id: NonNullable<KnowledgeCardMeta['paperStyle']>; label: string }> = [
  { id: 'plain', label: 'Liso' },
  { id: 'lined', label: 'Pautado' },
  { id: 'grid', label: 'Quadriculado' },
  { id: 'dotted', label: 'Pontilhado' },
  { id: 'cornell', label: 'Cornell' },
];

const QUICK_STICKERS = ['💡', '⚠️', '📌', '🧠', '✅', '⚖️', '🎯'];
const CALLOUT_SWATCHES = ['#f59e0b', '#f43f5e', '#f97316', '#0ea5e9', '#10b981', '#6366f1', '#a855f7', '#27272a'];
const CALLOUT_TEXT_SWATCHES = ['', '#fde68a', '#ffffff', '#18181b', '#fecdd3', '#bae6fd', '#a7f3d0', '#c7d2fe'];
const CALLOUT_ICONS = ['', '⚠️', '🎯', '💡', '📌', '⚖️', '🔥', 'none'];
const CALLOUT_POSITIONS: Array<{ id: CalloutPosition; label: string }> = [
  { id: 'bottom', label: 'Rodapé' },
  { id: 'top', label: 'Topo' },
  { id: 'side', label: 'Lateral' },
  { id: 'inline', label: 'No texto' },
  { id: 'badge', label: 'Etiqueta' },
  { id: 'alert-box', label: 'Caixa Alerta' },
];

interface EditorInspectorPanelProps {
  fullCard: FullKnowledgeCard;
  onOpenNotebookModal: () => void;
  onAddAttachment: (att: LocalAttachment) => void;
  onRemoveAttachment: (attId: string) => void;
  onCloseEditor: () => void;
}

export function EditorInspectorPanel({
  fullCard,
  onOpenNotebookModal,
  onAddAttachment,
  onRemoveAttachment,
  onCloseEditor,
}: EditorInspectorPanelProps) {
  const {
    cardsById,
    canvasNodes,
    canvasEdges,
    hierarchy,
    openCard,
    openSecondaryCard,
    updateCardMeta,
    updateCanvasNode,
    saveCardContent,
    deleteCard,
    restoreCardBundle,
    duplicateCanvasNodes,
    convertCardToTextNode,
    undoConvertCardToText,
  } = useKnowledgeStore();
  const { theme, openConfirm, addToast, requestFocusCard } = useUiStore();

  const [tab, setTab] = useState<InspectorTab>('style');
  const [newTag, setNewTag] = useState('');
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});

  const meta = fullCard.meta;
  const cardCanvasNode = useMemo(
    () => canvasNodes.find((n) => n.nodeType === 'knowledgeCard' && n.cardId === meta.id) ?? null,
    [canvasNodes, meta.id]
  );

  const typo = resolveTypography(meta.typography, DEFAULT_CARD_TYPOGRAPHY);
  const isTypoCustomized =
    typo.fontSize !== DEFAULT_CARD_TYPOGRAPHY.fontSize ||
    typo.lineHeight !== DEFAULT_CARD_TYPOGRAPHY.lineHeight ||
    typo.paragraphSpacing !== DEFAULT_CARD_TYPOGRAPHY.paragraphSpacing;

  const callout = resolveCardCallout(meta);
  const calloutVisible = callout.visible !== false;
  const { bgStyle, textStyle } = resolveCalloutVisualColors(callout, theme);
  const surfaceHex = theme === 'paper' ? '#ffffff' : '#161920';
  const contrastRatio = getContrastRatio(textStyle, bgStyle, surfaceHex);
  const hasLowContrast = contrastRatio < MEETS_WCAG_AA;

  const updateCallout = (patch: Partial<CardCalloutConfig>) => {
    const next: CardCalloutConfig = { ...DEFAULT_CALLOUT_CONFIG, ...callout, ...patch };
    updateCardMeta(meta.id, { notes: next.text ?? '', callout: next });
  };

  const disciplines = useMemo(() => hierarchy.filter((h) => h.level === 'discipline'), [hierarchy]);
  const subjects = useMemo(
    () => hierarchy.filter((h) => h.level === 'subject' && h.parentId === meta.disciplineId),
    [hierarchy, meta.disciplineId]
  );
  const subsubjects = useMemo(
    () => hierarchy.filter((h) => h.level === 'subsubject' && h.parentId === meta.subjectId),
    [hierarchy, meta.subjectId]
  );
  const topics = useMemo(
    () => hierarchy.filter((h) => h.level === 'topic' && h.parentId === meta.subsubjectId),
    [hierarchy, meta.subsubjectId]
  );

  const backlinks = useMemo(
    () => Object.values(cardsById).filter((c) => c.outgoingLinkIds?.includes(meta.id)),
    [cardsById, meta.id]
  );

  const outgoingCards = useMemo(
    () =>
      (meta.outgoingLinkIds ?? [])
        .map((id) => cardsById[id])
        .filter((c): c is KnowledgeCardMeta => Boolean(c)),
    [cardsById, meta.outgoingLinkIds]
  );

  const canvasNeighborCards = useMemo(() => {
    if (!cardCanvasNode) return [];
    const neighborNodeIds = new Set<string>();
    for (const edge of canvasEdges) {
      if (edge.sourceNodeId === cardCanvasNode.id) neighborNodeIds.add(edge.targetNodeId);
      if (edge.targetNodeId === cardCanvasNode.id) neighborNodeIds.add(edge.sourceNodeId);
    }
    const list: KnowledgeCardMeta[] = [];
    for (const n of canvasNodes) {
      if (neighborNodeIds.has(n.id) && n.cardId && cardsById[n.cardId]) {
        list.push(cardsById[n.cardId]);
      }
    }
    return list;
  }, [cardCanvasNode, canvasEdges, canvasNodes, cardsById]);

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
    updateCardMeta(meta.id, { tags: [...meta.tags, clean] });
    setNewTag('');
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
      meta.id,
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
      meta.id,
      {
        ...fullCard.content,
        flashcards: fullCard.content.flashcards.filter((f) => f.id !== fcId),
        updatedAt: Date.now(),
      },
      fullCard.content.plainText
    );
  };

  const handleConvertToText = () => {
    if (!cardCanvasNode) return;
    const targetNodeId = cardCanvasNode.id;
    openConfirm({
      title: 'Converter card em Texto Livre?',
      description: `"${meta.title}" terá conteúdo, formatação, cor, tipografia, observação e conexões preservados como Texto Livre no Canvas. Você poderá desfazer logo após.`,
      confirmLabel: 'Converter em Texto',
      onConfirm: async () => {
        const result = await convertCardToTextNode(targetNodeId);
        if (result) {
          onCloseEditor();
          addToast({
            message: 'Card convertido em Texto Livre',
            variant: 'success',
            action: {
              label: 'Desfazer',
              onClick: () => undoConvertCardToText(result.textNodeId, result.undoBundle),
            },
          });
        }
      },
    });
  };

  const handleDelete = () => {
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
  };

  const tabItems: Array<{
    id: InspectorTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'style', label: 'Visual', icon: Palette },
    { id: 'callout', label: 'Destaque', icon: Sparkles },
    {
      id: 'study',
      label: 'Estudo',
      icon: Brain,
      badge: fullCard.content.flashcards.length + fullCard.content.attachments.length,
    },
    {
      id: 'relations',
      label: 'Info',
      icon: Sliders,
      badge: backlinks.length + canvasNeighborCards.length,
    },
  ];

  return (
    <aside className="flex h-full w-full flex-col border-t border-zinc-800/80 bg-[#101319]/95 lg:w-[350px] lg:shrink-0 lg:border-l lg:border-t-0 xl:w-[375px]">
      <div className="grid grid-cols-4 gap-1 border-b border-zinc-800/80 p-2">
        {tabItems.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition ${
              tab === id
                ? 'bg-indigo-600/20 text-indigo-200 ring-1 ring-indigo-500/40'
                : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
            {badge !== undefined && badge > 0 && (
              <span className="rounded-full bg-zinc-800 px-1.5 text-[9.5px] text-zinc-300">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {tab === 'style' && (
          <>
            <section className="space-y-3 rounded-2xl border border-zinc-800/80 bg-[#151922]/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <Palette className="h-3.5 w-3.5 text-indigo-400" /> Aparência do Card
              </div>

              <div>
                <span className="mb-1.5 block text-[11px] text-zinc-400">Cor de destaque</span>
                <div className="flex items-center gap-2">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => updateCardMeta(meta.id, { color: c.id })}
                      title={c.label}
                      className={`h-6 w-6 rounded-full border-2 transition hover:scale-110 ${
                        meta.color === c.id ? 'scale-110 border-white' : 'border-transparent opacity-70'
                      }`}
                      style={{ backgroundColor: c.dot }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="mb-1 block text-[11px] text-zinc-400">Papel</span>
                  <select
                    value={meta.paperStyle ?? 'plain'}
                    onChange={(e) =>
                      updateCardMeta(meta.id, {
                        paperStyle: e.target.value as KnowledgeCardMeta['paperStyle'],
                      })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {PAPER_STYLES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="mb-1 block text-[11px] text-zinc-400">Borda</span>
                  <select
                    value={meta.borderStyle ?? 'solid'}
                    onChange={(e) =>
                      updateCardMeta(meta.id, {
                        borderStyle: e.target.value as KnowledgeCardMeta['borderStyle'],
                      })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="solid">Sólida</option>
                    <option value="dashed">Tracejada</option>
                    <option value="none">Sem borda</option>
                  </select>
                </div>
              </div>

              {cardCanvasNode && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="mb-1 block text-[11px] text-zinc-400">Dimensionamento</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMode = cardCanvasNode.sizingMode === 'auto' ? 'custom' : 'auto';
                        updateCanvasNode(cardCanvasNode.id, {
                          sizingMode: nextMode,
                          height: nextMode === 'auto' ? 0 : Math.max(160, cardCanvasNode.height || 240),
                        });
                      }}
                      className={`flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                        cardCanvasNode.sizingMode === 'auto'
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                          : 'border-zinc-800 bg-[#0F1115] text-zinc-300 hover:border-indigo-500/60'
                      }`}
                    >
                      <Minimize2 className="h-3.5 w-3.5" />
                      {cardCanvasNode.sizingMode === 'auto' ? 'Ajustar ao texto' : 'Tamanho livre'}
                    </button>
                  </div>

                  <div>
                    <span className="mb-1 block text-[11px] text-zinc-400">Margem interna</span>
                    <select
                      value={cardCanvasNode.padding ?? 'md'}
                      onChange={(e) =>
                        updateCanvasNode(cardCanvasNode.id, {
                          padding: e.target.value as CanvasNodePosition['padding'],
                        })
                      }
                      className="w-full rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="sm">Compacta</option>
                      <option value="md">Padrão</option>
                      <option value="lg">Ampla</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <span className="mb-1.5 block text-[11px] text-zinc-400">Adesivo / Ícone</span>
                <div className="flex flex-wrap items-center gap-1">
                  {QUICK_STICKERS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => updateCardMeta(meta.id, { emoji })}
                      className={`rounded-lg border px-2 py-1 text-xs transition ${
                        meta.emoji === emoji
                          ? 'border-indigo-500 bg-indigo-500/20'
                          : 'border-zinc-800 bg-[#0F1115] hover:bg-zinc-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateCardMeta(meta.id, { emoji: undefined })}
                    className="rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-100"
                  >
                    Sem
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-zinc-800/80 bg-[#151922]/70 p-3.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <Type className="h-3.5 w-3.5 text-indigo-400" /> Tipografia do Card
                </span>
                <button
                  type="button"
                  disabled={!isTypoCustomized}
                  onClick={() => updateCardMeta(meta.id, { typography: undefined })}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-35"
                >
                  <RotateCcw className="h-3 w-3" /> Restaurar
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Tamanho da fonte</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateCardMeta(meta.id, {
                          typography: resolveTypography(
                            { ...typo, fontSize: typo.fontSize - 1 },
                            DEFAULT_CARD_TYPOGRAPHY
                          ),
                        })
                      }
                      className="rounded bg-zinc-800 p-0.5 text-zinc-300 hover:bg-zinc-700"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-10 text-center font-mono text-xs text-zinc-100">
                      {typo.fontSize}px
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateCardMeta(meta.id, {
                          typography: resolveTypography(
                            { ...typo, fontSize: typo.fontSize + 1 },
                            DEFAULT_CARD_TYPOGRAPHY
                          ),
                        })
                      }
                      className="rounded bg-zinc-800 p-0.5 text-zinc-300 hover:bg-zinc-700"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={TYPOGRAPHY_LIMITS.fontSize.min}
                  max={TYPOGRAPHY_LIMITS.fontSize.max}
                  step={1}
                  value={typo.fontSize}
                  onChange={(e) =>
                    updateCardMeta(meta.id, {
                      typography: resolveTypography(
                        { ...typo, fontSize: Number(e.target.value) },
                        DEFAULT_CARD_TYPOGRAPHY
                      ),
                    })
                  }
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Espaço entre linhas</span>
                  <span className="font-mono text-zinc-100">{typo.lineHeight.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={TYPOGRAPHY_LIMITS.lineHeight.min}
                  max={TYPOGRAPHY_LIMITS.lineHeight.max}
                  step={0.05}
                  value={typo.lineHeight}
                  onChange={(e) =>
                    updateCardMeta(meta.id, {
                      typography: resolveTypography(
                        { ...typo, lineHeight: Number(e.target.value) },
                        DEFAULT_CARD_TYPOGRAPHY
                      ),
                    })
                  }
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Espaço entre parágrafos</span>
                  <span className="font-mono text-zinc-100">{typo.paragraphSpacing}px</span>
                </div>
                <input
                  type="range"
                  min={TYPOGRAPHY_LIMITS.paragraphSpacing.min}
                  max={TYPOGRAPHY_LIMITS.paragraphSpacing.max}
                  step={1}
                  value={typo.paragraphSpacing}
                  onChange={(e) =>
                    updateCardMeta(meta.id, {
                      typography: resolveTypography(
                        { ...typo, paragraphSpacing: Number(e.target.value) },
                        DEFAULT_CARD_TYPOGRAPHY
                      ),
                    })
                  }
                  className="w-full accent-indigo-500"
                />
              </div>
            </section>
          </>
        )}

        {tab === 'callout' && (
          <section className="space-y-3.5 rounded-2xl border border-zinc-800/80 bg-[#151922]/70 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                <Sparkles className="h-3.5 w-3.5" /> Observação / Pegadinha
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateCallout({ visible: !calloutVisible })}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium ${
                    calloutVisible
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {calloutVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {calloutVisible ? 'Visível' : 'Oculta'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateCallout({
                      ...DEFAULT_CALLOUT_CONFIG,
                      bgColor: undefined,
                      textColor: undefined,
                      borderColor: undefined,
                      icon: undefined,
                    })
                  }
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  title="Restaurar estilo amarelo padrão"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={callout.text ?? ''}
              onChange={(e) => updateCallout({ text: e.target.value })}
              placeholder="Escreva a pegadinha de banca, mnemônico ou exceção..."
              className="w-full resize-none rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500/60 focus:outline-none"
            />

            <div>
              <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                Estilo
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(CALLOUT_PRESETS) as CalloutPreset[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      updateCallout({
                        preset: key,
                        ...(key !== 'custom'
                          ? { bgColor: undefined, textColor: undefined, borderColor: undefined }
                          : {}),
                      })
                    }
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                      (callout.preset ?? 'highlight') === key
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {CALLOUT_PRESETS[key].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                Posição no Card
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {CALLOUT_POSITIONS.map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => updateCallout({ position: pos.id })}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                      (callout.position ?? 'bottom') === pos.id
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                  Destaque
                </span>
                <div className="flex gap-1">
                  {(
                    [
                      { id: 'subtle', label: 'Suave' },
                      { id: 'medium', label: 'Médio' },
                      { id: 'strong', label: 'Forte' },
                    ] as Array<{ id: CalloutEmphasis; label: string }>
                  ).map((em) => (
                    <button
                      key={em.id}
                      type="button"
                      onClick={() => updateCallout({ emphasis: em.id })}
                      className={`flex-1 rounded-lg border py-1 text-[10.5px] ${
                        (callout.emphasis ?? 'medium') === em.id
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                          : 'border-zinc-800 bg-[#0F1115] text-zinc-400'
                      }`}
                    >
                      {em.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                  Alinhamento
                </span>
                <div className="flex gap-1">
                  {(
                    [
                      { id: 'left', icon: AlignLeft },
                      { id: 'center', icon: AlignCenter },
                      { id: 'right', icon: AlignRight },
                    ] as const
                  ).map(({ id, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => updateCallout({ align: id })}
                      className={`flex flex-1 items-center justify-center rounded-lg border py-1 ${
                        (callout.align ?? 'left') === id
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                          : 'border-zinc-800 bg-[#0F1115] text-zinc-400'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-[#0F1115] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase text-zinc-500">Fundo</span>
                <div className="flex items-center gap-1">
                  {CALLOUT_SWATCHES.map((hex) => (
                    <button
                      key={`ebg-${hex}`}
                      type="button"
                      onClick={() => updateCallout({ preset: 'custom', bgColor: hex })}
                      className={`h-4 w-4 rounded border transition hover:scale-110 ${
                        callout.bgColor === hex ? 'scale-110 border-white' : 'border-zinc-700'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase text-zinc-500">Texto</span>
                <div className="flex items-center gap-1">
                  {CALLOUT_TEXT_SWATCHES.map((hex) => (
                    <button
                      key={`etx-${hex || 'auto'}`}
                      type="button"
                      onClick={() => updateCallout({ textColor: hex || undefined })}
                      className={`flex h-4 w-4 items-center justify-center rounded-full border text-[8px] text-zinc-400 transition hover:scale-110 ${
                        (callout.textColor ?? '') === hex ? 'scale-110 border-white' : 'border-zinc-700'
                      }`}
                      style={hex ? { backgroundColor: hex } : undefined}
                    >
                      {!hex && 'A'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase text-zinc-500">Borda</span>
                <div className="flex items-center gap-1">
                  {CALLOUT_SWATCHES.map((hex) => (
                    <button
                      key={`ebd-${hex}`}
                      type="button"
                      onClick={() => updateCallout({ borderColor: hex })}
                      className={`h-4 w-4 rounded-full border transition hover:scale-110 ${
                        callout.borderColor === hex ? 'scale-110 border-white' : 'border-zinc-700'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {hasLowContrast && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  Contraste baixo ({contrastRatio.toFixed(1)}:1)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateCallout({ textColor: suggestAccessibleTextColor(bgStyle, surfaceHex) })
                  }
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-500 px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-rose-400"
                >
                  <Wand2 className="h-3 w-3" /> Corrigir
                </button>
              </div>
            )}

            <div>
              <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
                Ícone
              </span>
              <div className="flex flex-wrap gap-1">
                {CALLOUT_ICONS.map((ic) => (
                  <button
                    key={ic || 'auto'}
                    type="button"
                    onClick={() => updateCallout({ icon: ic || undefined })}
                    className={`rounded-lg border px-2 py-1 text-[11px] ${
                      (callout.icon ?? '') === ic
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-400'
                    }`}
                  >
                    {ic === '' ? 'Auto' : ic === 'none' ? 'Sem' : ic}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {tab === 'study' && (
          <>
            <section className="space-y-3 rounded-2xl border border-zinc-800/80 bg-[#151922]/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                <Brain className="h-3.5 w-3.5" /> Flashcards ({fullCard.content.flashcards.length})
              </div>

              <div className="space-y-2">
                {fullCard.content.flashcards.map((fc) => {
                  const flipped = !!flippedIds[fc.id];
                  return (
                    <div
                      key={fc.id}
                      onClick={() => setFlippedIds((p) => ({ ...p, [fc.id]: !p[fc.id] }))}
                      className="group relative cursor-pointer rounded-xl border border-zinc-800 bg-[#0F1115] p-3 transition hover:border-indigo-500/40"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFlashcard(fc.id);
                        }}
                        className="absolute right-2 top-2 rounded p-1 text-zinc-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                        title="Remover flashcard"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {flipped ? 'Resposta' : 'Pergunta'}
                      </p>
                      <p className="mt-1 pr-5 text-xs leading-relaxed text-zinc-100">
                        {flipped ? fc.back : fc.front}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-[#0F1115]/80 p-2.5">
                <input
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="Frente (Pergunta)..."
                  className="w-full rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                />
                <input
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddFlashcard();
                  }}
                  placeholder="Verso (Resposta objetiva)..."
                  className="w-full rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddFlashcard}
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar Flashcard
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800/80 bg-[#151922]/70 p-3.5">
              <AttachmentManager
                attachments={fullCard.content.attachments}
                onAddAttachment={onAddAttachment}
                onRemoveAttachment={onRemoveAttachment}
              />
            </section>
          </>
        )}

        {tab === 'relations' && (
          <>
            <section className="space-y-3 rounded-2xl border border-zinc-800/80 bg-[#151922]/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <FolderTree className="h-3.5 w-3.5 text-indigo-400" /> Organização & Metadados
              </div>

              <div className="space-y-2">
                <select
                  value={meta.disciplineId || ''}
                  onChange={(e) =>
                    updateCardMeta(meta.id, {
                      disciplineId: e.target.value,
                      subjectId: '',
                      subsubjectId: null,
                      topicId: null,
                    })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Disciplina...</option>
                  {disciplines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>

                {subjects.length > 0 && (
                  <select
                    value={meta.subjectId || ''}
                    onChange={(e) =>
                      updateCardMeta(meta.id, {
                        subjectId: e.target.value,
                        subsubjectId: null,
                        topicId: null,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Assunto...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                )}

                {subsubjects.length > 0 && (
                  <select
                    value={meta.subsubjectId || ''}
                    onChange={(e) =>
                      updateCardMeta(meta.id, {
                        subsubjectId: e.target.value || null,
                        topicId: null,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Subassunto...</option>
                    {subsubjects.map((ss) => (
                      <option key={ss.id} value={ss.id}>
                        {ss.title}
                      </option>
                    ))}
                  </select>
                )}

                {topics.length > 0 && (
                  <select
                    value={meta.topicId || ''}
                    onChange={(e) =>
                      updateCardMeta(meta.id, { topicId: e.target.value || null })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Tópico...</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => updateCardMeta(meta.id, { isPinned: !meta.isPinned })}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${
                    meta.isPinned
                      ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300'
                      : 'border-zinc-800 bg-[#0F1115] text-zinc-400'
                  }`}
                >
                  <Pin className="h-3 w-3" /> Fixar
                </button>
                <button
                  type="button"
                  onClick={() => updateCardMeta(meta.id, { isFavorite: !meta.isFavorite })}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${
                    meta.isFavorite
                      ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                      : 'border-zinc-800 bg-[#0F1115] text-zinc-400'
                  }`}
                >
                  <Star className="h-3 w-3" /> Favorito
                </button>
                <button
                  type="button"
                  onClick={onOpenNotebookModal}
                  className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#0F1115] px-2 py-1 text-[11px] text-emerald-300 hover:border-emerald-500/50"
                >
                  <Bookmark className="h-3 w-3" /> Cadernos ({meta.notebookIds?.length ?? 0})
                </button>
              </div>

              <div className="flex gap-1">
                {(
                  [
                    { id: 'normal', label: 'Normal' },
                    { id: 'high', label: 'Importante' },
                    { id: 'critical', label: 'Crítico' },
                  ] as Array<{ id: ImportanceLevel; label: string }>
                ).map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => updateCardMeta(meta.id, { importance: lvl.id })}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border py-1 text-[11px] font-medium ${
                      meta.importance === lvl.id
                        ? lvl.id === 'critical'
                          ? 'border-rose-500/60 bg-rose-500/20 text-rose-300'
                          : lvl.id === 'high'
                          ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                          : 'border-indigo-500/60 bg-indigo-500/20 text-indigo-200'
                        : 'border-zinc-800 bg-[#0F1115] text-zinc-400'
                    }`}
                  >
                    {lvl.id === 'critical' && <Flame className="h-3 w-3" />}
                    {lvl.label}
                  </button>
                ))}
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-1 text-[11px] text-zinc-400">
                  <Tag className="h-3 w-3" /> Tags
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {meta.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-[#0F1115] px-2 py-0.5 text-[11px] text-zinc-300"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() =>
                          updateCardMeta(meta.id, { tags: meta.tags.filter((t) => t !== tag) })
                        }
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
                    placeholder="+ tag (Enter)"
                    className="w-24 rounded-md bg-[#0F1115] px-2 py-0.5 text-[11px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-[#0F1115] px-3 py-2 text-[11px] text-zinc-400">
                Revisado <strong className="text-zinc-200">{meta.reviewCount}×</strong>
                {meta.nextReviewAt
                  ? ` • Próxima revisão: ${new Date(meta.nextReviewAt).toLocaleDateString('pt-BR')}`
                  : ' • Ainda não revisado'}
              </div>
            </section>

            <section className="space-y-2.5 rounded-2xl border border-zinc-800/80 bg-[#151922]/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <Link2 className="h-3.5 w-3.5 text-sky-400" /> Conexões
              </div>

              {canvasNeighborCards.length === 0 &&
              outgoingCards.length === 0 &&
              backlinks.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Nenhuma conexão ou menção ainda. Use <code>[[</code> no texto ou ligue setas no Canvas.
                </p>
              ) : (
                <div className="space-y-2">
                  {[
                    { title: 'Conectados no Canvas', list: canvasNeighborCards },
                    { title: 'Links neste card', list: outgoingCards },
                    { title: 'Mencionado em (Backlinks)', list: backlinks },
                  ]
                    .filter((g) => g.list.length > 0)
                    .map((group) => (
                      <div key={group.title} className="space-y-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          {group.title}
                        </span>
                        {group.list.map((target) => (
                          <div
                            key={`${group.title}-${target.id}`}
                            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#0F1115] px-2.5 py-1.5 text-xs text-zinc-200"
                          >
                            <button
                              type="button"
                              onClick={() => openCard(target.id)}
                              className="min-w-0 flex-1 truncate text-left hover:text-indigo-300"
                            >
                              {target.title}
                            </button>
                            <div className="ml-2 flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openSecondaryCard(target.id)}
                                className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-indigo-300"
                                title="Abrir lado a lado"
                              >
                                Lado a lado
                              </button>
                              <ArrowUpRight className="h-3 w-3 text-zinc-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="space-y-2 rounded-2xl border border-zinc-800/80 bg-[#151922]/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <Sliders className="h-3.5 w-3.5 text-amber-400" /> Ações Avançadas
              </div>

              <button
                type="button"
                onClick={() => {
                  requestFocusCard(meta.id);
                  onCloseEditor();
                }}
                className="flex w-full items-center gap-2 rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-indigo-500/50"
              >
                <Crosshair className="h-3.5 w-3.5 text-indigo-400" /> Localizar este card no Canvas
              </button>

              {cardCanvasNode && (
                <>
                  <button
                    type="button"
                    onClick={handleConvertToText}
                    className="flex w-full items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
                  >
                    <FileType className="h-3.5 w-3.5" /> Converter Card em Texto Livre
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await duplicateCanvasNodes([cardCanvasNode.id]);
                      addToast({ message: 'Card duplicado no Canvas', variant: 'success' });
                    }}
                    className="flex w-full items-center gap-2 rounded-xl border border-zinc-800 bg-[#0F1115] px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-indigo-500/50"
                  >
                    <Copy className="h-3.5 w-3.5 text-sky-400" /> Duplicar Card
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleDelete}
                className="flex w-full items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir Knowledge Card
              </button>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}