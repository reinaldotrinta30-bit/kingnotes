import { create } from 'zustand';
import { applyCustomFontToDom, hydrateCustomFonts } from '../utils/customFonts';

export type CanvasSpotlightMode = 'none' | 'due' | 'critical' | 'pinned' | 'favorites';
export type CardDensity = 'compact' | 'comfortable' | 'expanded';
export type CanvasBackgroundStyle = 'dots' | 'grid' | 'none';
export type BookWidth = 'narrow' | 'medium' | 'wide';
export type BookFont = 'serif' | 'sans';
export type BookFontSize = 'sm' | 'base' | 'lg';
export type EditorPresentationMode = 'expanded' | 'side';

export interface UserPreferences {
  cardDensity: CardDensity;
  canvasBackground: CanvasBackgroundStyle;
  bookWidth: BookWidth;
  bookFont: BookFont;
  bookFontSize: BookFontSize;
  customFontFamily: string | null;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  cardDensity: 'comfortable',
  canvasBackground: 'dots',
  bookWidth: 'medium',
  bookFont: 'serif',
  bookFontSize: 'base',
  customFontFamily: null,
};

const PREFS_STORAGE_KEY = 'kc_preferences_v1';

export interface ToastItem {
  id: string;
  message: string;
  variant?: 'default' | 'success' | 'danger';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ConfirmDialogState {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
}

interface UiState {
  theme: 'dark' | 'paper';
  preferences: UserPreferences;
  isPreferencesOpen: boolean;
  isBackupOpen: boolean;
  isPdfReaderOpen: boolean;
  togglePdfReader: () => void;
  setPdfReaderOpen: (open: boolean) => void;

  toasts: ToastItem[];
  confirmDialog: ConfirmDialogState | null;
  sidebarCollapsed: boolean;
  zenMode: boolean;

  // Motor Cognitivo no Canvas
  canvasRecallMode: boolean;
  canvasSpotlight: CanvasSpotlightMode;

  // "Voar até o Card" + pulso luminoso
  focusRequest: { cardId: string; nonce: number } | null;
  highlightedCardId: string | null;
  inlineEditingCardId: string | null;
  setInlineEditingCardId: (cardId: string | null) => void;
  isCanvasZoomedOut: boolean;
  setCanvasZoomedOut: (zoomedOut: boolean) => void;
  croppingImageNodeId: string | null;
  setCroppingImageNodeId: (nodeId: string | null) => void;
  editingTextNodeId: string | null;
  setEditingTextNodeId: (nodeId: string | null) => void;
  editingTopicNodeId: string | null;
  setEditingTopicNodeId: (nodeId: string | null) => void;
  selectedEdgeLabelId: string | null;
  setSelectedEdgeLabelId: (edgeId: string | null) => void;
  editingEdgeLabelId: string | null;
  setEditingEdgeLabelId: (edgeId: string | null) => void;
  editorPresentation: EditorPresentationMode;
  setEditorPresentation: (mode: EditorPresentationMode) => void;
  toggleEditorPresentation: () => void;
  hasUnsavedEditorChanges: boolean;
  setHasUnsavedEditorChanges: (dirty: boolean) => void;
  clearTransientCanvasUi: () => void;

  hydrateUi: () => void;
  toggleTheme: () => void;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
  setPreferencesOpen: (open: boolean) => void;
  setBackupOpen: (open: boolean) => void;

  addToast: (toast: Omit<ToastItem, 'id'>, durationMs?: number) => void;
  dismissToast: (id: string) => void;
  openConfirm: (dialog: ConfirmDialogState) => void;
  closeConfirm: () => void;

  toggleSidebar: () => void;
  setZenMode: (enabled: boolean) => void;
  toggleZenMode: () => void;

  toggleCanvasRecallMode: () => void;
  setCanvasSpotlight: (mode: CanvasSpotlightMode) => void;

  requestFocusCard: (cardId: string) => void;
  clearFocusRequest: () => void;
  triggerCardHighlight: (cardId: string) => void;
}

let highlightTimer: ReturnType<typeof setTimeout> | null = null;

function applyThemeToDom(theme: 'dark' | 'paper') {
  if (typeof document === 'undefined') return;
  if (theme === 'paper') {
    document.documentElement.classList.add('paper');
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('paper');
  }
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'dark',
  preferences: DEFAULT_PREFERENCES,
  isPreferencesOpen: false,
  isBackupOpen: false,
  isPdfReaderOpen: false,

  toasts: [],
  confirmDialog: null,
  sidebarCollapsed: false,
  zenMode: false,
  canvasRecallMode: false,
  canvasSpotlight: 'none',
  focusRequest: null,
  highlightedCardId: null,
  inlineEditingCardId: null,
  isCanvasZoomedOut: false,
  croppingImageNodeId: null,
  editingTextNodeId: null,
  editingTopicNodeId: null,
  selectedEdgeLabelId: null,
  editingEdgeLabelId: null,
  editorPresentation: 'expanded',
  hasUnsavedEditorChanges: false,

  hydrateUi: () => {
    if (typeof window === 'undefined') return;

    const savedTheme = localStorage.getItem('kc_theme') as 'dark' | 'paper' | null;
    const theme: 'dark' | 'paper' = savedTheme === 'paper' ? 'paper' : 'dark';
    applyThemeToDom(theme);

    let preferences = DEFAULT_PREFERENCES;
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        preferences = { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) };
      }
    } catch {
      // mantém padrão
    }

    set({ theme, preferences });
    hydrateCustomFonts(preferences.customFontFamily);
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'paper' : 'dark';
    if (typeof window !== 'undefined') localStorage.setItem('kc_theme', next);
    applyThemeToDom(next);
    set({ theme: next });
  },

  updatePreferences: (patch) => {
    const next = { ...get().preferences, ...patch };
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
    }
    if ('customFontFamily' in patch) {
      applyCustomFontToDom(next.customFontFamily);
    }
    set({ preferences: next });
  },

  resetPreferences: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
    }
    applyCustomFontToDom(null);
    set({ preferences: DEFAULT_PREFERENCES });
  },

  setPreferencesOpen: (isPreferencesOpen) => set({ isPreferencesOpen }),
  setBackupOpen: (isBackupOpen) => set({ isBackupOpen }),
  togglePdfReader: () => set((s) => ({ isPdfReaderOpen: !s.isPdfReaderOpen })),
  setPdfReaderOpen: (isPdfReaderOpen) => set({ isPdfReaderOpen }),

  addToast: (toast, durationMs = 4500) => {
    const id = `toast-${crypto.randomUUID()}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
    setTimeout(() => {
      get().dismissToast(id);
    }, durationMs);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  openConfirm: (confirmDialog) => set({ confirmDialog }),
  closeConfirm: () => set({ confirmDialog: null }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setZenMode: (zenMode) => set({ zenMode }),
  toggleZenMode: () => set((s) => ({ zenMode: !s.zenMode })),

  toggleCanvasRecallMode: () => set((s) => ({ canvasRecallMode: !s.canvasRecallMode })),
  setCanvasSpotlight: (canvasSpotlight) => set({ canvasSpotlight }),

  requestFocusCard: (cardId) =>
    set({ focusRequest: { cardId, nonce: Date.now() } }),

  clearFocusRequest: () => set({ focusRequest: null }),
  setInlineEditingCardId: (inlineEditingCardId) => set({ inlineEditingCardId }),
  setCanvasZoomedOut: (isCanvasZoomedOut) =>
    set((s) => (s.isCanvasZoomedOut === isCanvasZoomedOut ? s : { isCanvasZoomedOut })),
  setCroppingImageNodeId: (croppingImageNodeId) => set({ croppingImageNodeId }),
 setEditingTextNodeId: (editingTextNodeId) => set({ editingTextNodeId }),
  setEditingTopicNodeId: (editingTopicNodeId) => set({ editingTopicNodeId }),
  setSelectedEdgeLabelId: (selectedEdgeLabelId) => set({ selectedEdgeLabelId }),
  setEditingEdgeLabelId: (editingEdgeLabelId) => set({ editingEdgeLabelId }),
  setEditorPresentation: (editorPresentation) => set({ editorPresentation }),
  toggleEditorPresentation: () =>
    set((s) => ({
      editorPresentation: s.editorPresentation === 'expanded' ? 'side' : 'expanded',
    })),
  setHasUnsavedEditorChanges: (hasUnsavedEditorChanges) => set({ hasUnsavedEditorChanges }),
  clearTransientCanvasUi: () =>
    set({
      inlineEditingCardId: null,
      editingTextNodeId: null,
      editingTopicNodeId: null,
      croppingImageNodeId: null,
      selectedEdgeLabelId: null,
      editingEdgeLabelId: null,
      hasUnsavedEditorChanges: false,
    }),

  triggerCardHighlight: (cardId) => {
    if (highlightTimer) clearTimeout(highlightTimer);
    set({ highlightedCardId: cardId });
    highlightTimer = setTimeout(() => {
      set({ highlightedCardId: null });
    }, 2400);
  },
}));