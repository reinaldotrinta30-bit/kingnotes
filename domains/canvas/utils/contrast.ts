export const MEETS_WCAG_AA = 4.5;

interface RgbColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColorToRgba(input: string): RgbColor | null {
  const clean = input.trim();

  if (clean.startsWith('#')) {
    const hex = clean.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return Number.isNaN(r) ? null : { r, g, b, a: 1 };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r) ? null : { r, g, b, a: 1 };
    }
    return null;
  }

  const match = clean.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (!match) return null;

  return {
    r: Math.min(255, Number(match[1])),
    g: Math.min(255, Number(match[2])),
    b: Math.min(255, Number(match[3])),
    a: match[4] !== undefined ? Math.max(0, Math.min(1, Number(match[4]))) : 1,
  };
}

export function hexToRgbaString(hex: string, alpha: number): string {
  const parsed = parseColorToRgba(hex);
  if (!parsed) return `rgba(245, 158, 11, ${alpha})`;
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

function compositeOverSurface(fg: RgbColor, bg: RgbColor): RgbColor {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

function relativeLuminance(c: RgbColor): number {
  const channels = [c.r, c.g, c.b].map((val) => {
    const srgb = val / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function getContrastRatio(
  textColor: string,
  bgColor: string,
  surfaceHex = '#161920'
): number {
  const fg = parseColorToRgba(textColor);
  const bg = parseColorToRgba(bgColor);
  const surface = parseColorToRgba(surfaceHex) ?? { r: 22, g: 25, b: 32, a: 1 };
  if (!fg || !bg) return 7;

  const effectiveBg = bg.a < 1 ? compositeOverSurface(bg, surface) : bg;
  const effectiveFg = fg.a < 1 ? compositeOverSurface(fg, effectiveBg) : fg;

  const l1 = relativeLuminance(effectiveFg);
  const l2 = relativeLuminance(effectiveBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function suggestAccessibleTextColor(bgColor: string, surfaceHex = '#161920'): string {
  const whiteRatio = getContrastRatio('#ffffff', bgColor, surfaceHex);
  const darkRatio = getContrastRatio('#18181b', bgColor, surfaceHex);
  return whiteRatio >= darkRatio ? '#ffffff' : '#18181b';
}