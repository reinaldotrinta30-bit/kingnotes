'use client';

import React, { useEffect, useId, useState } from 'react';
import katex from 'katex';
import { Link2 } from 'lucide-react';
import { TextTypographyConfig } from '@/domains/knowledge/types';
import {
  DEFAULT_CARD_TYPOGRAPHY,
  DEFAULT_TEXT_TYPOGRAPHY,
  resolveTypography,
} from '@/domains/knowledge/utils/defaults';
import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { ClozeText } from '@/domains/review/components/ClozeText';
import { getFontFamilyCss } from '../utils/studyFonts';

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TipTapMark[];
  content?: TipTapNode[];
}

const previewCache = new Map<string, TipTapNode>();

export function setCardPreviewCache(cardId: string, doc: Record<string, unknown>) {
  previewCache.set(cardId, doc as unknown as TipTapNode);
}

export function buildTypographyCssVars(
  typography?: TextTypographyConfig,
  defaults: Required<TextTypographyConfig> = DEFAULT_CARD_TYPOGRAPHY,
  legacyFontSize?: number
): React.CSSProperties {
  const resolved = resolveTypography(typography, defaults, legacyFontSize);
  const customStudyFont =
    resolved.fontFamily && resolved.fontFamily !== 'default'
      ? getFontFamilyCss(resolved.fontFamily)
      : undefined;
  return {
    ['--kc-font-size' as string]: `${resolved.fontSize}px`,
    ['--kc-line-height' as string]: String(resolved.lineHeight),
    ['--kc-p-spacing' as string]: `${resolved.paragraphSpacing}px`,
    ...(customStudyFont ? { ['--kc-font-family' as string]: customStudyFont } : {}),
    ['--kc-fx-color' as string]: resolved.effectColor,
  };
}

function StudyTapeSpan({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((v) => !v);
      }}
      title={revealed ? 'Clique para cobrir novamente' : 'Fita de ocultação — clique para revelar'}
      className={`kc-study-tape nodrag ${revealed ? 'is-revealed' : ''}`}
    >
      {children}
    </span>
  );
}

function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState('');
  const uid = useId().replace(/:/g, '');

  useEffect(() => {
    let cancelled = false;
    import('mermaid')
      .then(async (mod) => {
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#1e2230',
            primaryTextColor: '#e4e4e7',
            primaryBorderColor: '#6366f1',
            lineColor: '#818cf8',
          },
        });
        const { svg: rendered } = await mermaid.render(`mmd-prev-${uid}`, code);
        if (!cancelled) setSvg(rendered);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, uid]);

  if (!svg) return null;
  return (
    <div
      className="my-2 flex justify-center overflow-hidden rounded-lg bg-zinc-900/40 p-2 [&>svg]:max-h-40 [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function WikiLinkChip({ cardId, label }: { cardId: string; label: string }) {
  const openCard = useKnowledgeStore((s) => s.openCard);
  const openSecondaryCard = useKnowledgeStore((s) => s.openSecondaryCard);
  const activeCardId = useKnowledgeStore((s) => s.activeCardId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if ((e.shiftKey || e.altKey) && activeCardId) {
          openSecondaryCard(cardId);
        } else {
          openCard(cardId);
        }
      }}
      className="nodrag mx-0.5 inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 align-baseline text-[11.5px] font-medium text-indigo-300 transition hover:bg-indigo-500/25"
    >
      <Link2 className="h-3 w-3" />
      {label}
    </button>
  );
}

function renderMarks(text: string, marks?: TipTapMark[]): React.ReactNode {
  let node: React.ReactNode = /\{\{[^}]+\}\}/.test(text) ? <ClozeText text={text} /> : text;
  if (!marks || marks.length === 0) return node;

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        node = <strong>{node}</strong>;
        break;
      case 'italic':
        node = <em>{node}</em>;
        break;
      case 'underline':
        node = <u>{node}</u>;
        break;
      case 'strike':
        node = <s>{node}</s>;
        break;
      case 'code':
        node = <code>{node}</code>;
        break;
      case 'highlight': {
        const color = (mark.attrs?.color as string | undefined) || '#fde047';
        node = <mark style={{ backgroundColor: color }}>{node}</mark>;
        break;
      }
      case 'textStyle': {
        const color = mark.attrs?.color as string | undefined;
        if (color) node = <span style={{ color }}>{node}</span>;
        break;
      }
      case 'studyTape':
        node = <StudyTapeSpan>{node}</StudyTapeSpan>;
        break;
      case 'studyUnderline': {
        const ulColor = (mark.attrs?.color as string | undefined) || '#ef4444';
        const variant = (mark.attrs?.variant as string | undefined) || 'brush';
        node = (
          <span
            className={`kc-ul kc-ul-${variant}`}
            style={{ ['--kc-ul-color' as string]: ulColor }}
          >
            {node}
          </span>
        );
        break;
      }
      case 'studyFont': {
        const fontId = mark.attrs?.fontId as Parameters<typeof getFontFamilyCss>[0];
        const fam = getFontFamilyCss(fontId);
        if (fam !== 'inherit') {
          node = (
            <span data-study-font={fontId} style={{ fontFamily: fam }}>
              {node}
            </span>
          );
        }
        break;
      }
      default:
        break;
    }
    
  }
  
  return node;
   
  

}


function renderTipTapNode(node: TipTapNode, key: string): React.ReactNode {
  const children = node.content?.map((child, idx) => renderTipTapNode(child, `${key}-${idx}`));
  const align = node.attrs?.textAlign as React.CSSProperties['textAlign'] | undefined;
  const alignStyle = align ? { textAlign: align } : undefined;

  switch (node.type) {
    case 'doc':
      return <>{children}</>;
    case 'text':
      return <React.Fragment key={key}>{renderMarks(node.text ?? '', node.marks)}</React.Fragment>;
    case 'hardBreak':
      return <br key={key} />;
    case 'paragraph':
      return (
        <p key={key} style={alignStyle}>
          {children && children.length > 0 ? children : '\u00A0'}
        </p>
      );
    case 'heading': {
      const level = Number(node.attrs?.level ?? 3);
      if (level === 1) return <h1 key={key} style={alignStyle}>{children}</h1>;
      if (level === 2) return <h2 key={key} style={alignStyle}>{children}</h2>;
      return <h3 key={key} style={alignStyle}>{children}</h3>;
    }
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return <ol key={key}>{children}</ol>;
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'taskList':
      return (
        <ul key={key} data-type="taskList">
          {children}
        </ul>
      );
    case 'taskItem': {
      const checked = Boolean(node.attrs?.checked);
      return (
        <li key={key} data-checked={checked ? 'true' : 'false'}>
          <label>
            <input type="checkbox" checked={checked} readOnly />
          </label>
          <div>{children}</div>
        </li>
      );
    }
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
    case 'horizontalRule': {
      const cls = (node.attrs?.class as string | undefined) ?? 'kc-hr-solid';
      return <hr key={key} className={cls} />;
    }
    case 'table':
      return (
        <table key={key}>
          <tbody>{children}</tbody>
        </table>
      );
    case 'tableRow':
      return <tr key={key}>{children}</tr>;
    case 'tableHeader':
      return <th key={key}>{children}</th>;
    case 'tableCell':
      return <td key={key}>{children}</td>;
    case 'image': {
      const src = node.attrs?.src as string | undefined;
      if (!src) return null;
      return <img key={key} src={src} alt={(node.attrs?.alt as string) ?? ''} />;
    }
    case 'mathBlock': {
      const latex = (node.attrs?.latex as string) ?? '';
      if (!latex.trim()) return null;
      const html = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        strict: false,
      });
      return (
        <div
          key={key}
          className="my-2 overflow-x-auto rounded-lg bg-zinc-900/40 px-2 py-1 text-center"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case 'mermaidBlock': {
      const code = (node.attrs?.code as string) ?? '';
      return code ? <MermaidPreview key={key} code={code} /> : null;
    }
    case 'wikiLink': {
      const cardId = (node.attrs?.cardId as string) ?? '';
      const label = (node.attrs?.label as string) ?? 'Card';
      return cardId ? <WikiLinkChip key={key} cardId={cardId} label={label} /> : null;
    }
    default:
      return children ? <div key={key}>{children}</div> : null;
  }
}

export function RichDocRenderer({
  doc,
  className = '',
  typography,
  legacyFontSize,
}: {
  doc?: Record<string, unknown> | null;
  className?: string;
  typography?: TextTypographyConfig;
  legacyFontSize?: number;
}) {
  const parsed = doc as unknown as TipTapNode | null;
  if (!parsed?.content || parsed.content.length === 0) return null;
  const typoStyle = buildTypographyCssVars(typography, DEFAULT_TEXT_TYPOGRAPHY, legacyFontSize);
  return (
    <div style={typoStyle} className={`ProseMirror ${className}`}>
      {renderTipTapNode(parsed, 'free-text')}
    </div>
  );
}

interface CardRichPreviewProps {
  cardId: string;
  updatedAt: number;
  fallbackExcerpt: string;
  typography?: TextTypographyConfig;
}

export function CardRichPreview({
  cardId,
  updatedAt,
  fallbackExcerpt,
  typography,
}: CardRichPreviewProps) {
  const [doc, setDoc] = useState<TipTapNode | null>(() => previewCache.get(cardId) ?? null);

  useEffect(() => {
    let active = true;
    const cached = previewCache.get(cardId);
    if (cached) setDoc(cached);

    const timer = setTimeout(() => {
      getKnowledgeRepository()
        .getFullCard(cardId)
        .then((full) => {
          if (!active || !full) return;
          const loaded = full.content.tiptapJson as unknown as TipTapNode;
          previewCache.set(cardId, loaded);
          setDoc(loaded);
        });
    }, 50);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cardId, updatedAt]);

  const typoStyle = buildTypographyCssVars(typography, DEFAULT_CARD_TYPOGRAPHY);
  const hasDocContent = Boolean(doc?.content && doc.content.length > 0);

  if (!hasDocContent) {
    return (
      <p
        style={{
          fontSize: 'var(--kc-font-size)',
          lineHeight: 'var(--kc-line-height)',
          ...typoStyle,
        }}
        className="text-zinc-400"
      >
        <ClozeText text={fallbackExcerpt} />
      </p>
    );
  }

  return (
    <div style={typoStyle} className="ProseMirror kc-inline-prose">
      {renderTipTapNode(doc!, cardId)}
    </div>
  );
}