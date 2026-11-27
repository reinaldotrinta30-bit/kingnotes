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

/** Escopo hierárquico compartilhado por Cards, elementos do Canvas e Traços */
export interface HierarchyScope {
  disciplineId?: string | null;
  subjectId?: string | null;
  subsubjectId?: string | null;
  topicId?: string | null;
}

export type StudyFontId =
  | 'default'
  | 'hand-print'
  | 'hand-script'
  | 'hand-marker'
  | 'lettering-brush'
  | 'rounded'
  | 'draft'
  | 'serif'
  | 'mono';

export type TextEffectId = 'none' | 'outline' | 'shadow3d' | 'gradient' | 'glow';

export interface TextTypographyConfig {
  fontSize?: number;
  lineHeight?: number;
  paragraphSpacing?: number;
  fontFamily?: StudyFontId;
  textEffect?: TextEffectId;
  effectColor?: string;
}

export interface CardTitleStyle {
  fontFamily?: StudyFontId;
  fontSize?: number;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  textEffect?: TextEffectId;
  effectColor?: string;
  fontWeight?: 'normal' | 'semibold' | 'bold';
  italic?: boolean;
  underline?: boolean;
}

/** Observação Rápida / Pegadinha da Banca personalizável */
export type CalloutPreset =
  | 'highlight'
  | 'alert'
  | 'tag'
  | 'note'
  | 'info'
  | 'warning'
  | 'custom';

export type CalloutPosition = 'top' | 'bottom' | 'side' | 'inline' | 'badge' | 'alert-box';

export type CalloutEmphasis = 'subtle' | 'medium' | 'strong';

export interface CardCalloutConfig {
  text?: string;
  visible?: boolean;
  preset?: CalloutPreset;
  position?: CalloutPosition;
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  icon?: string;
  emphasis?: CalloutEmphasis;
  align?: 'left' | 'center' | 'right';
}

/** Tópicos, Subtópicos e Balões de Mapa Mental / Fluxograma */
export type TopicShape =
  | 'rect'
  | 'rounded'
  | 'square'
  | 'circle'
  | 'ellipse'
  | 'diamond'
  | 'capsule'
  | 'hexagon'
  | 'cloud'
  | 'banner'
  | 'speech'
  | 'sticky-tape';

export interface TopicNodeConfig {
  shape: TopicShape;
  shadow?: 'none' | 'sm' | 'md' | 'glow';
  icon?: string;
  doubleBorder?: boolean;
  parentTopicId?: string | null;
  defaultEdgeStyle?: {
    edgeType?: CanvasEdgePathType;
    color?: string;
    lineStyle?: EdgeLineStyle;
  };
}

/** Conexões flexíveis (automáticas + waypoints manuais) */
export interface EdgeWaypoint {
  x: number;
  y: number;
}

export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';
export type EdgeArrowType = 'none' | 'arrow' | 'arrowclosed' | 'dot' | 'hand';
export type CanvasEdgePathType = 'smoothstep' | 'default' | 'straight' | 'organic';

/** Configuração editorial do Modo Livro (separada das coordenadas X/Y do Canvas) */
export type BookItemRole = 'chapter' | 'section' | 'content';

export interface BookItemEntry {
  id: string;
  sourceType: 'topic' | 'card' | 'text' | 'image';
  sourceId: string;
  role: BookItemRole;
  included: boolean;
}

export interface BookProjectConfig {
  title?: string;
  subtitle?: string;
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
  margins?: 'narrow' | 'normal' | 'wide';
  showPageBreaks?: boolean;
  includeCallouts?: boolean;
  includeImages?: boolean;
  includeFreeTexts?: boolean;
  outlineOrder?: BookItemEntry[];
  updatedAt?: number;
}

export interface Workspace extends SyncableEntity {
  name: string;
  icon: string;
  color: string;
  description?: string;
  bookConfig?: BookProjectConfig;
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
  titleStyle?: CardTitleStyle;
  workspaceId: string;
  disciplineId: string;
  subjectId: string;
  subsubjectId?: string | null;
  topicId?: string | null;

  title: string;
  excerpt: string; // Resumo curto (max ~240 chars) para renderização rápida no Canvas
  notes: string;   // Observações pessoais / mnemônicos / jurisprudência (sincronizado com callout.text)
  callout?: CardCalloutConfig;
  typography?: TextTypographyConfig;
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

export interface CanvasNodePosition extends SyncableEntity, HierarchyScope {
  workspaceId: string;
  cardId?: string;          // Presente se for um Knowledge Card
  groupId?: string | null;  // Agrupamento pai no canvas
  nodeType: 'knowledgeCard' | 'group' | 'image' | 'text' | 'topic';
  label?: string;           // Título para grupos visuais ou tópicos
  color?: string;           // Cor principal / borda
  bgColor?: string;         // Cor interna do grupo / bloco de texto / tópico
  bgOpacity?: 'transparent' | 'subtle' | 'tinted' | 'solid';
  sizingMode?: 'auto' | 'custom'; // Flexibilidade de dimensão para cards e balões
  typography?: TextTypographyConfig;
  callout?: CardCalloutConfig;
  topicConfig?: TopicNodeConfig;
  textJson?: Record<string, unknown>; // Conteúdo rico TipTap para Texto Livre
  plainText?: string;                 // Texto plano para busca/promoção p/ Card
  textColor?: string;                 // Cor base do texto livre / tópico
  fontSize?: number;                  // Legado mantido em sincronia com typography.fontSize
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
  sketch?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeLabelStyle {
  preset?: 'auto' | 'neutral' | 'tinted' | 'solid' | 'transparent' | 'custom';
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'none';
  fontSize?: number;
  fontFamily?: StudyFontId;
  textEffect?: TextEffectId;
  effectColor?: string;
  fontWeight?: 'normal' | 'medium' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  rotation?: number;    // Ângulo manual em graus (-180 a 180)
  autoRotate?: boolean; // Alinha automaticamente ao ângulo do segmento da seta
  width?: number;       // Largura manual em px (undefined = automático)
  height?: number;      // Altura manual em px (undefined = automático)
}

export interface CanvasConnection extends SyncableEntity {
  workspaceId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  edgeType?: CanvasEdgePathType;
  routingMode?: 'auto' | 'manual';
  waypoints?: EdgeWaypoint[];
  strokeWidth?: number;
  lineStyle?: EdgeLineStyle;
  arrowStart?: EdgeArrowType;
  arrowEnd?: EdgeArrowType;
  label?: string;
  labelPosition?: number; // Posição normalizada ao longo da conexão (0.08 a 0.92)
  labelStyle?: EdgeLabelStyle;
  labelOffset?: { x: number; y: number };
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

export interface CanvasStroke extends SyncableEntity, HierarchyScope {
  workspaceId: string;
  tool: StrokeTool;
  color: string;
  width: number;
  opacity: number;
  points: StrokePoint[];
}