'use client';

import React from 'react';
import { CanvasNodePosition } from '@/domains/knowledge/types';
import { DEFAULT_TEXT_TYPOGRAPHY } from '@/domains/knowledge/utils/defaults';
import { RichDocRenderer } from '@/domains/canvas/components/CardRichPreview';
import { CalloutBadge } from '@/domains/canvas/components/CalloutBadge';
import { hexToRgbaString } from '@/domains/canvas/utils/contrast';

interface BookFreeTextBlockProps {
  node: CanvasNodePosition;
  showCallouts: boolean;
  theme: 'dark' | 'paper';
  isPrintSheet?: boolean;
}

export function BookFreeTextBlock({
  node,
  showCallouts,
  theme,
  isPrintSheet = false,
}: BookFreeTextBlockProps) {
  const effectiveTheme: 'dark' | 'paper' = isPrintSheet ? 'paper' : theme;
  const hasBackground = node.bgOpacity && node.bgOpacity !== 'transparent';
  const accentHex = node.bgColor ?? node.color ?? '#6366f1';

  const bgColor = !hasBackground
    ? undefined
    : hexToRgbaString(accentHex, effectiveTheme === 'paper' ? 0.1 : 0.12);

  const borderColor = hasBackground
    ? hexToRgbaString(accentHex, effectiveTheme === 'paper' ? 0.35 : 0.4)
    : undefined;

  const hasCallout =
    showCallouts &&
    Boolean((node.callout?.text ?? '').trim()) &&
    node.callout?.visible !== false;

  return (
    <div
      style={
        hasBackground
          ? { backgroundColor: bgColor, borderColor }
          : undefined
      }
      className={`kc-book-avoid-break rounded-2xl transition ${
        hasBackground
          ? 'border px-5 py-4'
          : 'px-1 py-1.5'
      } ${effectiveTheme === 'paper' ? 'text-zinc-800' : 'text-zinc-200'}`}
    >
      <RichDocRenderer
        doc={node.textJson}
        className="kc-free-text-prose"
        typography={node.typography ?? DEFAULT_TEXT_TYPOGRAPHY}
        legacyFontSize={node.fontSize}
      />

      {hasCallout && node.callout && (
        <CalloutBadge config={node.callout} theme={effectiveTheme} className="mt-3" />
      )}
    </div>
  );
}