'use client';

import React, { useState, useMemo } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import katex from 'katex';
import { Sigma } from 'lucide-react';

function MathNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const latex: string = node.attrs.latex ?? '';
  const [editing, setEditing] = useState(!latex);

  const renderedHtml = useMemo(() => {
    if (!latex.trim()) return '';
    return katex.renderToString(latex, {
      displayMode: true,
      throwOnError: false,
      strict: false,
    });
  }, [latex]);

  return (
    <NodeViewWrapper
      className={`my-3 rounded-xl border p-3 transition ${
        selected
          ? 'border-indigo-500/70 bg-indigo-950/20'
          : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
      }`}
    >
      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5 font-medium text-indigo-300">
              <Sigma className="h-3.5 w-3.5" /> Fórmula LaTeX (KaTeX)
            </span>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-500"
            >
              Renderizar (Esc)
            </button>
          </div>
          <textarea
            autoFocus
            rows={2}
            value={latex}
            onChange={(e) => updateAttributes({ latex: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
                e.preventDefault();
                setEditing(false);
              }
            }}
            placeholder="Ex: M = C \cdot (1 + i)^t"
            className="w-full resize-none rounded-lg bg-zinc-950/80 p-2 font-mono text-xs text-zinc-100 focus:outline-none"
          />
          {renderedHtml && (
            <div
              className="overflow-x-auto rounded-lg bg-zinc-950/40 px-3 py-2 text-zinc-200"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="cursor-pointer overflow-x-auto py-1 text-center text-zinc-100"
          title="Clique para editar a fórmula"
          dangerouslySetInnerHTML={{
            __html: renderedHtml || '<span class="text-xs text-zinc-500">Clique para escrever fórmula LaTeX</span>',
          }}
        />
      )}
    </NodeViewWrapper>
  );
}

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});