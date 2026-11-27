import { StudyFontId, TextEffectId } from '@/domains/knowledge/types';

export interface StudyFontOption {
  id: StudyFontId;
  label: string;
  sample: string;
  cssFamily: string;
}

export const STUDY_FONT_OPTIONS: StudyFontOption[] = [
  { id: 'default', label: 'Padrão', sample: 'Aa', cssFamily: 'inherit' },
  {
    id: 'hand-print',
    label: 'Caderno',
    sample: 'Aa',
    cssFamily: 'var(--font-hand-print), cursive, sans-serif',
  },
  {
    id: 'hand-script',
    label: 'Manuscrita',
    sample: 'Aa',
    cssFamily: 'var(--font-hand-script), cursive',
  },
  {
    id: 'hand-marker',
    label: 'Caneta',
    sample: 'Aa',
    cssFamily: 'var(--font-hand-marker), cursive',
  },
  {
    id: 'lettering-brush',
    label: 'Lettering',
    sample: 'Aa',
    cssFamily: 'var(--font-lettering-brush), cursive',
  },
  {
    id: 'rounded',
    label: 'Destaque',
    sample: 'Aa',
    cssFamily: 'var(--font-rounded), sans-serif',
  },
  {
    id: 'draft',
    label: 'Esquema',
    sample: 'Aa',
    cssFamily: 'var(--font-draft), cursive',
  },
  {
    id: 'serif',
    label: 'Editorial',
    sample: 'Aa',
    cssFamily: 'var(--font-serif), Georgia, serif',
  },
  {
    id: 'mono',
    label: 'Código',
    sample: 'Aa',
    cssFamily: 'var(--font-mono), monospace',
  },
];

export const TEXT_EFFECT_OPTIONS: Array<{ id: TextEffectId; label: string }> = [
  { id: 'none', label: 'Normal' },
  { id: 'outline', label: 'Contorno' },
  { id: 'shadow3d', label: 'Sombra 3D' },
  { id: 'gradient', label: 'Degradê' },
  { id: 'glow', label: 'Brilho' },
];

export const EFFECT_COLOR_SWATCHES = [
  { label: 'Grafite / Preto', hex: '#0f172a' },
  { label: 'Branco', hex: '#ffffff' },
  { label: 'Azul Royal', hex: '#1d4ed8' },
  { label: 'Ciano', hex: '#06b6d4' },
  { label: 'Roxo', hex: '#7c3aed' },
  { label: 'Rosa', hex: '#ec4899' },
  { label: 'Âmbar', hex: '#f59e0b' },
  { label: 'Verde', hex: '#10b981' },
];

export function getFontFamilyCss(fontId?: StudyFontId): string {
  if (!fontId || fontId === 'default') return 'inherit';
  return STUDY_FONT_OPTIONS.find((f) => f.id === fontId)?.cssFamily ?? 'inherit';
}

export function getTextEffectClass(effectId?: TextEffectId): string {
  switch (effectId) {
    case 'outline':
      return 'kc-fx-outline';
    case 'shadow3d':
      return 'kc-fx-shadow3d';
    case 'gradient':
      return 'kc-fx-gradient';
    case 'glow':
      return 'kc-fx-glow';
    default:
      return '';
  }
}