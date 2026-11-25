export type HierarchyLevel = 'discipline' | 'subject' | 'subsubject' | 'topic';

export type ImportanceLevel = 'normal' | 'high' | 'critical';

export type SyncStatus = 'local_only' | 'synced' | 'pending_push' | 'conflict';

/** Metadados de sincronização já preparados para futura migração ao Supabase */
export interface SyncableEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null; // Soft delete para sync futuro sem conflito
  syncStatus: SyncStatus;
  version: number;
}

export interface Workspace extends SyncableEntity {
  name: string;
  icon: string;
  color: string;
  description?: string;
}

export interface StudyNotebook extends SyncableEntity {
  name: string;
  color: string;
  description?: string;
}

export interface HierarchyNode extends SyncableEntity {
  workspaceId: string;
  parentId: string | null;
  level: HierarchyLevel;
  title: string;
  order: number;
  color?: string;
}

export interface EmbeddedFlashcard {
  id: string;
  front: string;
  back: string;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: number;
}

export interface LocalAttachment {
  id: string;
  type: 'image' | 'pdf' | 'audio' | 'diagram';
  name: string;
  mimeType: string;
  blobId: string; // Referência para tabela dedicada de Blobs no IndexedDB
  sizeBytes: number;
}

/**
 * Metadados leves do Card (carregados em listas, canvas e filtros para 100k+ notas)
 */
export interface KnowledgeCardMeta extends SyncableEntity {
  workspaceId: string;
  disciplineId: string;
  subjectId: string;
  subsubjectId?: string | null;
  topicId?: string | null;

  title: string;
  excerpt: string; // Resumo curto (max ~240 chars) para renderização rápida no Canvas
  notes: string;   // Observações pessoais / mnemônicos / jurisprudência
  tags: string[];
  notebookIds?: string[];
  color: 'default' | 'amber' | 'emerald' | 'sky' | 'rose' | 'violet';
  emoji?: string;
  paperStyle?: 'plain' | 'lined' | 'grid' | 'dotted' | 'cornell';
  borderStyle?: 'solid' | 'dashed' | 'none';
  borderWidth?: 'thin' | 'medium' | 'thick';

  // Revisão & Prioridade
  isFavorite: boolean;
  isPinned: boolean;
  importance: ImportanceLevel;
  reviewCount: number;
  lastReviewedAt: number | null;
  nextReviewAt: number | null;
  easeFactor?: number;
  intervalDays?: number;
  repetitions?: number;

  // Links internos [[id]] para grafo de conhecimento
  outgoingLinkIds: string[];

  // Índice invertido pré-tokenizado para busca instantânea
  searchTokens: string[];
}

/**
 * Conteúdo pesado separado em tabela própria (lazy-loaded)
 */
export interface KnowledgeCardContent {
  cardId: string;
  tiptapJson: Record<string, unknown>; // Rich text, tabelas, checklists, código, destaques, fórmulas
  plainText: string;
  flashcards: EmbeddedFlashcard[];
  attachments: LocalAttachment[];
  updatedAt: number;
}

export interface FullKnowledgeCard {
  meta: KnowledgeCardMeta;
  content: KnowledgeCardContent;
}

export interface CanvasNodePosition extends SyncableEntity {
  workspaceId: string;
  cardId?: string;          // Presente se for um Knowledge Card
  groupId?: string | null;  // Agrupamento pai no canvas
  nodeType: 'knowledgeCard' | 'group' | 'image' | 'text';
  label?: string;           // Título para grupos visuais
  color?: string;           // Cor principal / borda
  bgColor?: string;         // Cor interna do grupo / bloco de texto
  bgOpacity?: 'transparent' | 'subtle' | 'tinted' | 'solid';
  textJson?: Record<string, unknown>; // Conteúdo rico TipTap para Texto Livre
  plainText?: string;                 // Texto plano para busca/promoção p/ Card
  textColor?: string;                 // Cor base do texto livre
  fontSize?: number;                  // Tamanho base da fonte (px)
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderWidth?: 'thin' | 'medium' | 'thick';
  blobId?: string;          // Imagem solta salva no IndexedDB
  caption?: string;         // Legenda opcional da imagem solta
  imageFit?: 'contain' | 'cover' | 'fill';
  keepAspectRatio?: boolean;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  cropZoom?: number;
  cropX?: number;
  cropY?: number;
  borderRadius?: 'none' | 'md' | 'xl' | 'full';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasConnection extends SyncableEntity {
  workspaceId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  edgeType?: 'smoothstep' | 'default';
  label?: string;
  style: 'solid' | 'dashed' | 'animated';
  color?: string;
}

export interface ReviewLog extends SyncableEntity {
  cardId: string;
  reviewedAt: number;
  confidence: 'hard' | 'good' | 'easy';
  durationMs: number;
}

export interface StudySession extends SyncableEntity {
  workspaceId: string;
  disciplineId?: string | null;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  mode: 'pomodoro25' | 'deep50' | 'free';
}

export type StrokeTool = 'pen' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'ellipse';

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface CanvasStroke extends SyncableEntity {
  workspaceId: string;
  tool: StrokeTool;
  color: string;
  width: number;
  opacity: number;
  points: StrokePoint[];
}