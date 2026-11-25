'use client';

import React, { useState } from 'react';

interface ClozeTextProps {
  text: string;
  defaultRevealed?: boolean;
  className?: string;
}

/**
 * Renderiza textos contendo lacunas no formato {{resposta}}
 * como pílulas interativas que revelam o conteúdo ao clicar.
 */
export function ClozeText({ text, defaultRevealed = false, className }: ClozeTextProps) {
  const [revealedMap, setRevealedMap] = useState<Record<number, boolean>>({});
  const parts = text.split(/(\{\{[^}]+\}\})/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith('{{') && part.endsWith('}}')) {
          const inner = part.slice(2, -2);
          const isOpen = defaultRevealed || !!revealedMap[idx];
          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRevealedMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
              }}
              title={isOpen ? 'Clique para ocultar novamente' : 'Clique para revelar a lacuna'}
              className={`mx-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 font-semibold transition ${
                isOpen
                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border border-indigo-500/40 bg-indigo-500/20 text-transparent select-none hover:bg-indigo-500/30'
              }`}
            >
              <span className={isOpen ? '' : 'blur-[5px] text-indigo-200'}>{inner}</span>
            </button>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
}

export function extractClozeItemsFromText(plainText: string): Array<{ masked: string; revealed: string }> {
  const results: Array<{ masked: string; revealed: string }> = [];
  const lines = plainText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\{\{[^}]+\}\}/.test(l));

  for (const line of lines) {
    const matches = Array.from(line.matchAll(/\{\{([^}]+)\}\}/g));
    matches.forEach((m, index) => {
      let currentIdx = 0;
      const masked = line.replace(/\{\{([^}]+)\}\}/g, (_, inner: string) => {
        const isTarget = currentIdx === index;
        currentIdx += 1;
        return isTarget ? '[ ... ]' : inner;
      });
      const revealed = line.replace(/\{\{([^}]+)\}\}/g, '$1');
      results.push({ masked, revealed: `${revealed}\n\nResposta da lacuna: ${m[1]}` });
    });
  }
  return results;
}