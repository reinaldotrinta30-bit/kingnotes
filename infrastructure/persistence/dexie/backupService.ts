import { db } from './db';

const LAST_BACKUP_KEY = 'kc_last_backup_at';

interface SerializedBlob {
  id: string;
  createdAt: number;
  mimeType: string;
  dataUrl: string;
}

interface BackupClientSettings {
  theme?: 'dark' | 'paper' | null;
  preferencesRaw?: string | null;
  pdfLibraryRaw?: string | null;
  customFontsRaw?: string | null;
  viewports?: Record<string, string>;
}

export interface KnowledgeCanvasBackup {
  format: 'knowledge-canvas-backup';
  schemaVersion: number;
  exportedAt: number;
  stats: {
    workspaces: number;
    cards: number;
    notebooks: number;
    reviews: number;
    studySessions: number;
    strokes: number;
    blobs: number;
  };
  data: {
    workspaces: unknown[];
    hierarchy: unknown[];
    cardsMeta: unknown[];
    cardContents: unknown[];
    canvasNodes: unknown[];
    canvasConnections: unknown[];
    reviewLogs: unknown[];
    notebooks: unknown[];
    studySessions?: unknown[];
    canvasStrokes?: unknown[];
    blobs: SerializedBlob[];
  };
  clientSettings?: BackupClientSettings;
}

export interface LocalStorageStats {
  workspaces: number;
  cards: number;
  notebooks: number;
  reviews: number;
  studySessions: number;
  strokes: number;
  attachments: number;
  totalBlobBytes: number;
  lastBackupAt: number | null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, fallbackMime = 'application/octet-stream'): Blob {
  const [header, base64] = dataUrl.split(',');
  if (!base64) return new Blob([], { type: fallbackMime });
  const mimeMatch = header?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function collectClientSettings(): BackupClientSettings {
  if (typeof window === 'undefined') return {};
  const viewports: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('kc_vp_')) {
      const val = localStorage.getItem(key);
      if (val) viewports[key] = val;
    }
  }

  const themeRaw = localStorage.getItem('kc_theme');
  return {
    theme: themeRaw === 'paper' || themeRaw === 'dark' ? themeRaw : null,
    preferencesRaw: localStorage.getItem('kc_preferences_v1'),
    pdfLibraryRaw: localStorage.getItem('kc_pdf_library_v1'),
    customFontsRaw: localStorage.getItem('kc_custom_fonts_v1'),
    viewports,
  };
}

function applyClientSettings(settings?: BackupClientSettings) {
  if (typeof window === 'undefined' || !settings) return;

  if (settings.theme) {
    localStorage.setItem('kc_theme', settings.theme);
  }
  if (typeof settings.preferencesRaw === 'string') {
    localStorage.setItem('kc_preferences_v1', settings.preferencesRaw);
  }
  if (typeof settings.pdfLibraryRaw === 'string') {
    localStorage.setItem('kc_pdf_library_v1', settings.pdfLibraryRaw);
  }
  if (typeof settings.customFontsRaw === 'string') {
    localStorage.setItem('kc_custom_fonts_v1', settings.customFontsRaw);
  }

  if (settings.viewports) {
    const oldViewportKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kc_vp_')) oldViewportKeys.push(key);
    }
    oldViewportKeys.forEach((k) => localStorage.removeItem(k));

    for (const [key, val] of Object.entries(settings.viewports)) {
      if (key.startsWith('kc_vp_') && typeof val === 'string') {
        localStorage.setItem(key, val);
      }
    }
  }
}

export function getLastBackupTimestamp(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LAST_BACKUP_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getLocalStorageStats(): Promise<LocalStorageStats> {
  const [workspaces, cards, notebooks, reviews, studySessions, strokes, blobs] = await Promise.all([
    db.workspaces.filter((w) => w.deletedAt === null).count(),
    db.cardsMeta.filter((c) => c.deletedAt === null).count(),
    db.notebooks.filter((n) => n.deletedAt === null).count(),
    db.reviewLogs.count(),
    db.studySessions.filter((s) => s.deletedAt === null).count(),
    db.canvasStrokes.filter((st) => st.deletedAt === null).count(),
    db.blobs.toArray(),
  ]);

  const totalBlobBytes = blobs.reduce((acc, b) => acc + (b.blob?.size ?? 0), 0);

  return {
    workspaces,
    cards,
    notebooks,
    reviews,
    studySessions,
    strokes,
    attachments: blobs.length,
    totalBlobBytes,
    lastBackupAt: getLastBackupTimestamp(),
  };
}

export async function exportFullBackup(): Promise<KnowledgeCanvasBackup> {
  const [
    workspaces,
    hierarchy,
    cardsMeta,
    cardContents,
    canvasNodes,
    canvasConnections,
    reviewLogs,
    notebooks,
    studySessions,
    canvasStrokes,
    rawBlobs,
  ] = await Promise.all([
    db.workspaces.toArray(),
    db.hierarchy.toArray(),
    db.cardsMeta.toArray(),
    db.cardContents.toArray(),
    db.canvasNodes.toArray(),
    db.canvasConnections.toArray(),
    db.reviewLogs.toArray(),
    db.notebooks.toArray(),
    db.studySessions.toArray(),
    db.canvasStrokes.toArray(),
    db.blobs.toArray(),
  ]);

  const serializedBlobs: SerializedBlob[] = [];
  for (const item of rawBlobs) {
    const dataUrl = await blobToDataUrl(item.blob);
    serializedBlobs.push({
      id: item.id,
      createdAt: item.createdAt,
      mimeType: item.blob.type || 'application/octet-stream',
      dataUrl,
    });
  }

  const exportedAt = Date.now();

  return {
    format: 'knowledge-canvas-backup',
    schemaVersion: 4,
    exportedAt,
    stats: {
      workspaces: workspaces.filter((w) => w.deletedAt === null).length,
      cards: cardsMeta.filter((c) => c.deletedAt === null).length,
      notebooks: notebooks.filter((n) => n.deletedAt === null).length,
      reviews: reviewLogs.length,
      studySessions: studySessions.filter((s) => s.deletedAt === null).length,
      strokes: canvasStrokes.filter((st) => st.deletedAt === null).length,
      blobs: serializedBlobs.length,
    },
    data: {
      workspaces,
      hierarchy,
      cardsMeta,
      cardContents,
      canvasNodes,
      canvasConnections,
      reviewLogs,
      notebooks,
      studySessions,
      canvasStrokes,
      blobs: serializedBlobs,
    },
    clientSettings: collectClientSettings(),
  };
}

export function triggerBackupDownload(backup: KnowledgeCanvasBackup): void {
  const json = JSON.stringify(backup);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateTag = new Date(backup.exportedAt).toISOString().slice(0, 10);

  const a = document.createElement('a');
  a.href = url;
  a.download = `knowledge-canvas-backup-${dateTag}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_BACKUP_KEY, String(backup.exportedAt));
  }
}

export async function restoreFullBackup(rawJson: string): Promise<KnowledgeCanvasBackup['stats']> {
  let parsed: KnowledgeCanvasBackup;
  try {
    parsed = JSON.parse(rawJson) as KnowledgeCanvasBackup;
  } catch {
    throw new Error('O arquivo selecionado não é um JSON válido.');
  }

  if (
    !parsed ||
    parsed.format !== 'knowledge-canvas-backup' ||
    !parsed.data ||
    !Array.isArray(parsed.data.workspaces) ||
    !Array.isArray(parsed.data.cardsMeta)
  ) {
    throw new Error('Arquivo inválido. Selecione um backup gerado pelo Knowledge Canvas.');
  }

  const restoredBlobs = (parsed.data.blobs ?? []).map((b) => ({
    id: b.id,
    createdAt: b.createdAt,
    blob: dataUrlToBlob(b.dataUrl, b.mimeType),
  }));

  const studySessions = Array.isArray(parsed.data.studySessions) ? parsed.data.studySessions : [];
  const canvasStrokes = Array.isArray(parsed.data.canvasStrokes) ? parsed.data.canvasStrokes : [];
  const notebooks = Array.isArray(parsed.data.notebooks) ? parsed.data.notebooks : [];

  await db.transaction(
    'rw',
    [
      db.workspaces,
      db.hierarchy,
      db.cardsMeta,
      db.cardContents,
      db.canvasNodes,
      db.canvasConnections,
      db.reviewLogs,
      db.notebooks,
      db.studySessions,
      db.canvasStrokes,
      db.blobs,
    ],
    async () => {
      await Promise.all([
        db.workspaces.clear(),
        db.hierarchy.clear(),
        db.cardsMeta.clear(),
        db.cardContents.clear(),
        db.canvasNodes.clear(),
        db.canvasConnections.clear(),
        db.reviewLogs.clear(),
        db.notebooks.clear(),
        db.studySessions.clear(),
        db.canvasStrokes.clear(),
        db.blobs.clear(),
      ]);

      await Promise.all([
        db.workspaces.bulkPut(parsed.data.workspaces as never[]),
        db.hierarchy.bulkPut((parsed.data.hierarchy ?? []) as never[]),
        db.cardsMeta.bulkPut(parsed.data.cardsMeta as never[]),
        db.cardContents.bulkPut((parsed.data.cardContents ?? []) as never[]),
        db.canvasNodes.bulkPut((parsed.data.canvasNodes ?? []) as never[]),
        db.canvasConnections.bulkPut((parsed.data.canvasConnections ?? []) as never[]),
        db.reviewLogs.bulkPut((parsed.data.reviewLogs ?? []) as never[]),
        db.notebooks.bulkPut(notebooks as never[]),
        db.studySessions.bulkPut(studySessions as never[]),
        db.canvasStrokes.bulkPut(canvasStrokes as never[]),
        db.blobs.bulkPut(restoredBlobs),
      ]);
    }
  );

  applyClientSettings(parsed.clientSettings);

  return {
    workspaces: parsed.stats?.workspaces ?? parsed.data.workspaces.length,
    cards: parsed.stats?.cards ?? parsed.data.cardsMeta.length,
    notebooks: parsed.stats?.notebooks ?? notebooks.length,
    reviews: parsed.stats?.reviews ?? (parsed.data.reviewLogs ?? []).length,
    studySessions: parsed.stats?.studySessions ?? studySessions.length,
    strokes: parsed.stats?.strokes ?? canvasStrokes.length,
    blobs: restoredBlobs.length,
  };
}