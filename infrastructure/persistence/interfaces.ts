import {
  CanvasConnection,
  CanvasNodePosition,
  FullKnowledgeCard,
  HierarchyNode,
  KnowledgeCardContent,
  KnowledgeCardMeta,
  ReviewLog,
  StudySession,
  CanvasStroke,
  Workspace,
  StudyNotebook,
} from '@/domains/knowledge/types';

export interface SearchFilters {
  query: string;
  workspaceId?: string;
  disciplineId?: string;
  subjectId?: string;
  tag?: string;
  onlyFavorites?: boolean;
  onlyPinned?: boolean;
  onlyHighImportance?: boolean;
  limit?: number;
}

export interface IKnowledgeRepository {
  // Workspaces
  listWorkspaces(): Promise<Workspace[]>;
  saveWorkspace(workspace: Workspace): Promise<void>;

  // Meus Cadernos (Polinização Cruzada)
  listNotebooks(): Promise<StudyNotebook[]>;
  saveNotebook(notebook: StudyNotebook): Promise<void>;
  deleteNotebook(id: string): Promise<void>;

  // Hierarquia
  listHierarchy(workspaceId: string): Promise<HierarchyNode[]>;
  saveHierarchyNode(node: HierarchyNode): Promise<void>;
  deleteHierarchyNode(id: string): Promise<void>;

  // Knowledge Cards (split meta/content)
  listCardMetasByWorkspace(workspaceId: string): Promise<KnowledgeCardMeta[]>;
  listCardMetasByHierarchy(filter: {
    disciplineId?: string;
    subjectId?: string;
    subsubjectId?: string;
    topicId?: string;
  }): Promise<KnowledgeCardMeta[]>;
  getFullCard(cardId: string): Promise<FullKnowledgeCard | null>;
  saveCard(meta: KnowledgeCardMeta, content?: KnowledgeCardContent): Promise<void>;
  softDeleteCard(cardId: string): Promise<void>;

  // Canvas (posições, grupos e conexões)
  listCanvasNodes(workspaceId: string): Promise<CanvasNodePosition[]>;
  upsertCanvasNodes(nodes: CanvasNodePosition[]): Promise<void>;
  deleteCanvasNode(nodeId: string): Promise<void>;

  listCanvasConnections(workspaceId: string): Promise<CanvasConnection[]>;
  saveCanvasConnection(edge: CanvasConnection): Promise<void>;
  deleteCanvasConnection(edgeId: string): Promise<void>;

  // Blobs locais (PDFs, Áudio, Imagens)
  saveBlob(id: string, blob: Blob): Promise<void>;
  getBlob(id: string): Promise<Blob | null>;

  // Busca instantânea
  searchCards(filters: SearchFilters): Promise<KnowledgeCardMeta[]>;

  // Revisão
  logReview(log: ReviewLog): Promise<void>;
  listReviewLogs(cardId?: string, limit?: number): Promise<ReviewLog[]>;

  // Sessões de Foco (Relógio + Heatmap)
  logStudySession(session: StudySession): Promise<void>;
  listStudySessions(limit?: number): Promise<StudySession[]>;

  // Camada de Desenho Livre (Stylus / Mouse)
  listCanvasStrokes(workspaceId: string): Promise<CanvasStroke[]>;
  saveCanvasStroke(stroke: CanvasStroke): Promise<void>;
  deleteCanvasStroke(strokeId: string): Promise<void>;
  clearWorkspaceStrokes(workspaceId: string): Promise<void>;
}