'use client';

import React, { useRef, useState } from 'react';
import { Upload, Trash2, X, Palette, Sparkles } from 'lucide-react';
import { HierarchyNode } from '@/domains/knowledge/types';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import {
  HIERARCHY_COLOR_PALETTE,
  HIERARCHY_QUICK_ICONS,
  HierarchyAvatar,
  prepareHierarchyCoverBlob,
} from './HierarchyAvatar';

interface HierarchyAppearanceModalProps {
  node: HierarchyNode | null;
  depth: number;
  indexInLevel?: number;
  inheritedColor?: string;
  onClose: () => void;
}

export function HierarchyAppearanceModal({
  node,
  depth,
  indexInLevel = 0,
  inheritedColor,
  onClose,
}: HierarchyAppearanceModalProps) {
  const updateHierarchyItem = useKnowledgeStore((s) => s.updateHierarchyItem);
  const addToast = useUiStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!node) return null;

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({ message: 'Selecione uma imagem válida (PNG, JPG ou WebP).', variant: 'danger' });
      return;
    }

    setUploading(true);
    try {
      const optimized = await prepareHierarchyCoverBlob(file);
      const blobId = `hier-cover-${crypto.randomUUID()}`;
      await getKnowledgeRepository().saveBlob(blobId, optimized);
      await updateHierarchyItem(node.id, { coverBlobId: blobId });
      addToast({ message: 'Capa atualizada e salva offline', variant: 'success' }, 2200);
    } catch {
      addToast({ message: 'Não foi possível processar a imagem.', variant: 'danger' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#161920] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Capa & Identidade</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Prévia ao vivo + Upload de Capa */}
        <div className="mb-5 flex items-center gap-4 rounded-2xl border border-zinc-800/80 bg-[#0F1115] p-3.5">
          <HierarchyAvatar
            node={node}
            depth={depth}
            indexInLevel={indexInLevel}
            inheritedColor={inheritedColor}
            size="lg"
          />

          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-xs font-semibold text-zinc-100">{node.title}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
                {uploading ? 'Salvando...' : node.coverBlobId ? 'Trocar capa' : 'Enviar capa'}
              </button>

              {node.coverBlobId && (
                <button
                  type="button"
                  onClick={() => updateHierarchyItem(node.id, { coverBlobId: null })}
                  className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-[#161920] px-2 py-1 text-[11px] text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10"
                  title="Remover foto de capa"
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadCover}
            />
          </div>
        </div>

        {/* Cor de destaque / anel */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <Palette className="h-3.5 w-3.5 text-indigo-400" /> Cor da Identidade
            </span>
            {node.color && (
              <button
                type="button"
                onClick={() => updateHierarchyItem(node.id, { color: undefined })}
                className="text-[10.5px] text-zinc-400 hover:text-zinc-200"
              >
                Automática
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {HIERARCHY_COLOR_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => updateHierarchyItem(node.id, { color: hex })}
                className={`h-6 w-6 rounded-full border-2 transition hover:scale-110 ${
                  node.color === hex ? 'scale-110 border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
            <input
              type="color"
              value={node.color || inheritedColor || '#6366f1'}
              onChange={(e) => updateHierarchyItem(node.id, { color: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded-full border border-zinc-700 bg-transparent p-0"
              title="Cor personalizada"
            />
          </div>
        </div>

        {/* Ícone / Emoji opcional (substitui o monograma ou numeração quando sem foto) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Ícone (quando sem foto)
            </span>
            {node.icon && (
              <button
                type="button"
                onClick={() => updateHierarchyItem(node.id, { icon: undefined })}
                className="text-[10.5px] text-zinc-400 hover:text-zinc-200"
              >
                Usar monograma / número
              </button>
            )}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {HIERARCHY_QUICK_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() =>
                  updateHierarchyItem(node.id, {
                    icon: node.icon === ic ? undefined : ic,
                    coverBlobId: null,
                  })
                }
                className={`flex h-9 items-center justify-center rounded-xl border text-base transition ${
                  node.icon === ic && !node.coverBlobId
                    ? 'border-indigo-500 bg-indigo-600/20'
                    : 'border-zinc-800 bg-[#0F1115] hover:border-zinc-700 hover:bg-zinc-800/70'
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-zinc-800/80 pt-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}