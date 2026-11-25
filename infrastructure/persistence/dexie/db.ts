import Dexie, { Table } from 'dexie';
import {
  CanvasConnection,
  CanvasNodePosition,
  HierarchyNode,
  KnowledgeCardContent,
  KnowledgeCardMeta,
  ReviewLog,
  StudySession,
  CanvasStroke,
  Workspace,
  StudyNotebook,
} from '@/domains/knowledge/types';

export interface StoredBlob {
  id: string;
  blob: Blob;
  createdAt: number;
}

export class KnowledgeCanvasDB extends Dexie {
  workspaces!: Table<Workspace, string>;
  hierarchy!: Table<HierarchyNode, string>;
  cardsMeta!: Table<KnowledgeCardMeta, string>;
  cardContents!: Table<KnowledgeCardContent, string>;
  canvasNodes!: Table<CanvasNodePosition, string>;
  canvasConnections!: Table<CanvasConnection, string>;
  reviewLogs!: Table<ReviewLog, string>;
  blobs!: Table<StoredBlob, string>;
  notebooks!: Table<StudyNotebook, string>;
  studySessions!: Table<StudySession, string>;
  canvasStrokes!: Table<CanvasStroke, string>;

  constructor() {
    super('KnowledgeCanvasDB_v1');

    this.version(1).stores({
      workspaces: 'id, updatedAt, deletedAt, syncStatus',
      hierarchy: 'id, workspaceId, parentId, level, [workspaceId+parentId], [workspaceId+level], deletedAt',
      cardsMeta: [
        'id',
        'workspaceId',
        'disciplineId',
        'subjectId',
        'subsubjectId',
        'topicId',
        '[workspaceId+disciplineId]',
        '[disciplineId+subjectId]',
        'isFavorite',
        'isPinned',
        'importance',
        'nextReviewAt',
        'updatedAt',
        'deletedAt',
        '*tags',
        '*searchTokens',
      ].join(', '),
      cardContents: 'cardId, updatedAt',
      canvasNodes: 'id, workspaceId, cardId, groupId, nodeType, deletedAt',
      canvasConnections: 'id, workspaceId, sourceNodeId, targetNodeId, deletedAt',
      reviewLogs: 'id, cardId, reviewedAt',
      blobs: 'id, createdAt',
    });

    this.version(2).stores({
      notebooks: 'id, updatedAt, deletedAt, syncStatus',
      cardsMeta: [
        'id',
        'workspaceId',
        'disciplineId',
        'subjectId',
        'subsubjectId',
        'topicId',
        '[workspaceId+disciplineId]',
        '[disciplineId+subjectId]',
        'isFavorite',
        'isPinned',
        'importance',
        'nextReviewAt',
        'updatedAt',
        'deletedAt',
        '*tags',
        '*notebookIds',
        '*searchTokens',
      ].join(', '),
    });

    this.version(3).stores({
      studySessions: 'id, workspaceId, disciplineId, startedAt, deletedAt',
    });

    this.version(4).stores({
      canvasStrokes: 'id, workspaceId, updatedAt, deletedAt',
    });
  }
}

export const db = new KnowledgeCanvasDB();