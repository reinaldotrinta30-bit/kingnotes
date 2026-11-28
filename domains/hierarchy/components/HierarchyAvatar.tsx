'use client';

import React, { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { HierarchyNode } from '@/domains/knowledge/types';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';

export const HIERARCHY_COLOR_PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#a855f7',
  '#14b8a6',
  '#f97316',
];

export const HIERARCHY_QUICK_ICONS = [
  '⚖️',
  '📚',
  '🧠',
  '🏛️',
  '💰',
  '📊',
  '💻',
  '🗺️',
  '📜',
  '🎯',
  '🔬',
  '📝',
  '🛡️',
  '⚡',
];

export function getDeterministicHierarchyColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return HIERARCHY_COLOR_PALETTE[hash % HIERARCHY_COLOR_PALETTE.length];
}

export function getMonogram(title: string): string {
  const words = title
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'KC';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Redimensiona e recorta a imagem de capa em quadrado 256×256 WebP leve para o IndexedDB */
export async function prepareHierarchyCoverBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file);
          },
          'image/webp',
          0.86
        );
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface HierarchyAvatarProps {
  node: HierarchyNode;
  depth: number;
  indexInLevel?: number;
  inheritedColor?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function HierarchyAvatar({
  node,
  depth,
  indexInLevel = 0,
  inheritedColor,
  size = 'md',
}: HierarchyAvatarProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!node.coverBlobId) {
      setCoverUrl(null);
      return;
    }

    getKnowledgeRepository()
      .getBlob(node.coverBlobId)
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setCoverUrl(objectUrl);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [node.coverBlobId]);

  const accent = node.color || inheritedColor || getDeterministicHierarchyColor(node.id);

  const sizeClass =
    size === 'sm'
      ? 'h-8 w-8 text-[11px]'
      : size === 'lg'
      ? 'h-14 w-14 text-lg'
      : 'h-10 w-10 text-xs';

  // 1. Capa personalizada (foto/imagem salva no IndexedDB)
  if (coverUrl) {
    return (
      <div
        style={{ boxShadow: `0 0 0 1.5px ${hexToRgba(accent, 0.55)}` }}
        className={`relative shrink-0 overflow-hidden rounded-full bg-zinc-900 ${sizeClass}`}
      >
        <img
          src={coverUrl}
          alt={node.title}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
    );
  }

  // 2. Ícone / Emoji escolhido pelo usuário
  if (node.icon) {
    return (
      <div
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(accent, 0.28)}, ${hexToRgba(accent, 0.1)})`,
          borderColor: hexToRgba(accent, 0.45),
        }}
        className={`flex shrink-0 items-center justify-center rounded-full border select-none ${sizeClass}`}
      >
        <span className={size === 'lg' ? 'text-2xl leading-none' : 'text-base leading-none'}>
          {node.icon}
        </span>
      </div>
    );
  }

  // 3. Fallback estratégico por nível hierárquico:
  // Disciplina (nível 0): gradiente editorial + monograma (2 iniciais)
  if (depth === 0) {
    return (
      <div
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(accent, 0.85)}, ${hexToRgba(accent, 0.42)})`,
          boxShadow: `inset 0 1px 1px rgba(255,255,255,0.22), 0 0 0 1.5px ${hexToRgba(accent, 0.45)}`,
        }}
        className={`flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight text-white select-none ${sizeClass}`}
      >
        {getMonogram(node.title)}
      </div>
    );
  }

  // Assunto (nível 1): numeração editorial elegante (01, 02, 03...) herdando a cor da Disciplina
  if (depth === 1) {
    const num = String(indexInLevel + 1).padStart(2, '0');
    return (
      <div
        style={{
          backgroundColor: hexToRgba(accent, 0.16),
          borderColor: hexToRgba(accent, 0.45),
          color: accent,
        }}
        className={`flex shrink-0 items-center justify-center rounded-full border font-mono font-bold select-none ${sizeClass}`}
      >
        {num}
      </div>
    );
  }

  // Subassuntos, Tópicos e Subtópicos (nível 2+): ícone geométrico minimalista na família de cor
  return (
    <div
      style={{
        backgroundColor: hexToRgba(accent, 0.12),
        borderColor: hexToRgba(accent, 0.35),
        color: accent,
      }}
      className={`flex shrink-0 items-center justify-center rounded-full border select-none ${sizeClass}`}
    >
      <GitBranch className={size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
    </div>
  );
}