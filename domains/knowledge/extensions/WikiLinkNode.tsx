'use client';

import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Link2 } from 'lucide-react';
import { useKnowledgeStore } from '../store/useKnowledgeStore';

function WikiLinkView({ node }: NodeViewProps) {
  const openCard = useKnowledgeStore((s) => s.openCard);
  const openSecondaryCard = useKnowledgeStore((s) => s.openSecondaryCard);
  const activeCardId = useKnowledgeStore((s) => s.activeCardId);

  const targetId: string = node.attrs.cardId;
  const label: string = node.attrs.label;

  return (
    <NodeViewWrapper as="span" className="inline">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          if ((e.shiftKey || e.altKey) && activeCardId) {
            openSecondaryCard(targetId);
          } else {
            openCard(targetId);
          }
        }}
        title="Clique para abrir • Shift + Clique para abrir lado a lado"
        className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 align-baseline text-[12px] font-medium text-indigo-300 transition hover:bg-indigo-500/25"
      >
        <Link2 className="h-3 w-3" />
        {label}
      </button>
    </NodeViewWrapper>
  );
}

export const WikiLinkNode = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      cardId: { default: null },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="wiki-link"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'wiki-link' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView);
  },
});

/** Extrai todos os IDs linkados no documento TipTap para manter o grafo sincronizado */
export function extractOutgoingLinkIds(doc: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; attrs?: { cardId?: string }; content?: unknown[] };
    if (n.type === 'wikiLink' && n.attrs?.cardId) {
      ids.add(n.attrs.cardId);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(doc);
  return Array.from(ids);
}