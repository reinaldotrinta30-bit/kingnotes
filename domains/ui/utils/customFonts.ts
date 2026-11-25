import { getKnowledgeRepository } from '@/infrastructure/persistence/repositoryFactory';

export interface CustomFontRecord {
  id: string;
  name: string;
  familyName: string;
  blobId: string;
  addedAt: number;
}

const CUSTOM_FONTS_KEY = 'kc_custom_fonts_v1';
const loadedFamilies = new Set<string>();

export function listCustomFonts(): CustomFontRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_FONTS_KEY);
    return raw ? (JSON.parse(raw) as CustomFontRecord[]) : [];
  } catch {
    return [];
  }
}

function saveCustomFontList(fonts: CustomFontRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(fonts));
}

export function applyCustomFontToDom(familyName: string | null) {
  if (typeof document === 'undefined') return;
  if (familyName) {
    document.documentElement.style.setProperty('--kc-custom-font', `"${familyName}"`);
    document.documentElement.dataset.customFont = 'active';
  } else {
    document.documentElement.style.removeProperty('--kc-custom-font');
    delete document.documentElement.dataset.customFont;
  }
}

async function registerFontFace(record: CustomFontRecord): Promise<boolean> {
  if (typeof window === 'undefined' || !('FontFace' in window)) return false;
  if (loadedFamilies.has(record.familyName)) return true;

  const blob = await getKnowledgeRepository().getBlob(record.blobId);
  if (!blob) return false;

  const buffer = await blob.arrayBuffer();
  const face = new FontFace(record.familyName, buffer);
  const loaded = await face.load();
  document.fonts.add(loaded);
  loadedFamilies.add(record.familyName);
  return true;
}

export async function importCustomFontFile(file: File): Promise<CustomFontRecord> {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.ttf') && !lower.endsWith('.otf') && !lower.endsWith('.woff2')) {
    throw new Error('Formato não suportado. Envie um arquivo .TTF, .OTF ou .WOFF2.');
  }

  const displayName = file.name.replace(/\.(ttf|otf|woff2)$/i, '').replace(/[_-]+/g, ' ').trim();
  const id = `font-${crypto.randomUUID()}`;
  const familyName = `KCFont_${id.slice(-8)}`;
  const blobId = `font-blob-${crypto.randomUUID()}`;

  await getKnowledgeRepository().saveBlob(blobId, file);

  const record: CustomFontRecord = {
    id,
    name: displayName || 'Fonte Personalizada',
    familyName,
    blobId,
    addedAt: Date.now(),
  };

  const ok = await registerFontFace(record);
  if (!ok) {
    throw new Error('Não foi possível carregar este arquivo de fonte no navegador.');
  }

  const next = [record, ...listCustomFonts()];
  saveCustomFontList(next);
  return record;
}

export function deleteCustomFontRecord(fontId: string): CustomFontRecord[] {
  const next = listCustomFonts().filter((f) => f.id !== fontId);
  saveCustomFontList(next);
  return next;
}

export async function hydrateCustomFonts(activeFamily: string | null): Promise<void> {
  const fonts = listCustomFonts();
  await Promise.all(fonts.map((f) => registerFontFace(f).catch(() => false)));
  applyCustomFontToDom(activeFamily);
}