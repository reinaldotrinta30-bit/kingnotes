import { db } from './db';
import { IKnowledgeRepository, SearchFilters } from '../interfaces';
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
import { normalizeText } from '@/domains/search/utils/tokenizer';
import { calculateSm2 } from '@/domains/review/utils/sm2';

export class DexieKnowledgeRepository implements IKnowledgeRepository {
  async listWorkspaces(): Promise<Workspace[]> {
    return db.workspaces.filter((w) => w.deletedAt === null).sortBy('createdAt');
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    await db.workspaces.put(workspace);
  }

  async deleteWorkspace(id: string): Promise<void> {
    await db.workspaces.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending_push',
    });
  }

  async listNotebooks(): Promise<StudyNotebook[]> {
    return db.notebooks.filter((n) => n.deletedAt === null).sortBy('createdAt');
  }

  async saveNotebook(notebook: StudyNotebook): Promise<void> {
    await db.notebooks.put(notebook);
  }

  async deleteNotebook(id: string): Promise<void> {
    await db.notebooks.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending_push',
    });
  }

  async listHierarchy(workspaceId: string): Promise<HierarchyNode[]> {
    const items = await db.hierarchy
      .where('workspaceId')
      .equals(workspaceId)
      .filter((n) => n.deletedAt === null)
      .toArray();
    return items.sort((a, b) => a.order - b.order);
  }

  async saveHierarchyNode(node: HierarchyNode): Promise<void> {
    await db.hierarchy.put(node);
  }

  async deleteHierarchyNode(id: string): Promise<void> {
    await db.hierarchy.update(id, { deletedAt: Date.now(), updatedAt: Date.now(), syncStatus: 'pending_push' });
  }

  async listCardMetasByWorkspace(workspaceId: string): Promise<KnowledgeCardMeta[]> {
    return db.cardsMeta
      .where('workspaceId')
      .equals(workspaceId)
      .filter((c) => c.deletedAt === null)
      .toArray();
  }

  async listCardMetasByHierarchy(filter: {
    disciplineId?: string;
    subjectId?: string;
    subsubjectId?: string;
    topicId?: string;
  }): Promise<KnowledgeCardMeta[]> {
    let collection = filter.disciplineId
      ? db.cardsMeta.where('disciplineId').equals(filter.disciplineId)
      : db.cardsMeta.toCollection();

    return collection
      .filter((c) => {
        if (c.deletedAt !== null) return false;
        if (filter.subjectId && c.subjectId !== filter.subjectId) return false;
        if (filter.subsubjectId && c.subsubjectId !== filter.subsubjectId) return false;
        if (filter.topicId && c.topicId !== filter.topicId) return false;
        return true;
      })
      .toArray();
  }

  async getFullCard(cardId: string): Promise<FullKnowledgeCard | null> {
    const [meta, content] = await Promise.all([
      db.cardsMeta.get(cardId),
      db.cardContents.get(cardId),
    ]);
    if (!meta || meta.deletedAt !== null) return null;

    return {
      meta,
      content: content ?? {
        cardId,
        tiptapJson: { type: 'doc', content: [{ type: 'paragraph' }] },
        plainText: '',
        flashcards: [],
        attachments: [],
        updatedAt: meta.updatedAt,
      },
    };
  }

  async saveCard(meta: KnowledgeCardMeta, content?: KnowledgeCardContent): Promise<void> {
    await db.transaction('rw', db.cardsMeta, db.cardContents, async () => {
      await db.cardsMeta.put(meta);
      if (content) {
        await db.cardContents.put(content);
      }
    });
  }

  async softDeleteCard(cardId: string): Promise<void> {
    const now = Date.now();
    await db.transaction('rw', db.cardsMeta, db.canvasNodes, async () => {
      await db.cardsMeta.update(cardId, { deletedAt: now, updatedAt: now, syncStatus: 'pending_push' });
      const linkedNodes = await db.canvasNodes.where('cardId').equals(cardId).toArray();
      for (const node of linkedNodes) {
        await db.canvasNodes.update(node.id, { deletedAt: now, updatedAt: now });
      }
    });
  }

  async listCanvasNodes(workspaceId: string): Promise<CanvasNodePosition[]> {
    return db.canvasNodes
      .where('workspaceId')
      .equals(workspaceId)
      .filter((n) => n.deletedAt === null)
      .toArray();
  }

  async upsertCanvasNodes(nodes: CanvasNodePosition[]): Promise<void> {
    await db.canvasNodes.bulkPut(nodes);
  }

  async deleteCanvasNode(nodeId: string): Promise<void> {
    await db.canvasNodes.update(nodeId, { deletedAt: Date.now(), updatedAt: Date.now() });
  }

  async listCanvasConnections(workspaceId: string): Promise<CanvasConnection[]> {
    return db.canvasConnections
      .where('workspaceId')
      .equals(workspaceId)
      .filter((e) => e.deletedAt === null)
      .toArray();
  }

  async saveCanvasConnection(edge: CanvasConnection): Promise<void> {
    await db.canvasConnections.put(edge);
  }

  async deleteCanvasConnection(edgeId: string): Promise<void> {
    await db.canvasConnections.update(edgeId, { deletedAt: Date.now(), updatedAt: Date.now() });
  }

  async saveBlob(id: string, blob: Blob): Promise<void> {
    await db.blobs.put({ id, blob, createdAt: Date.now() });
  }

  async getBlob(id: string): Promise<Blob | null> {
    const record = await db.blobs.get(id);
    return record?.blob ?? null;
  }

  async searchCards(filters: SearchFilters): Promise<KnowledgeCardMeta[]> {
    const limit = filters.limit ?? 40;
    const terms = normalizeText(filters.query)
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    // Usa o índice MultiEntry *searchTokens no primeiro termo (alta velocidade para 100k+)
    let candidates: KnowledgeCardMeta[];
    if (terms.length > 0) {
      candidates = await db.cardsMeta
        .where('searchTokens')
        .startsWith(terms[0])
        .distinct()
        .limit(limit * 4)
        .toArray();
    } else if (filters.tag) {
      candidates = await db.cardsMeta.where('tags').equals(filters.tag).limit(limit * 2).toArray();
    } else if (filters.workspaceId) {
      candidates = await db.cardsMeta
        .where('workspaceId')
        .equals(filters.workspaceId)
        .reverse()
        .limit(limit * 2)
        .toArray();
    } else {
      candidates = await db.cardsMeta.orderBy('updatedAt').reverse().limit(limit).toArray();
    }

    return candidates
      .filter((card) => {
        if (card.deletedAt !== null) return false;
        if (filters.workspaceId && card.workspaceId !== filters.workspaceId) return false;
        if (filters.disciplineId && card.disciplineId !== filters.disciplineId) return false;
        if (filters.subjectId && card.subjectId !== filters.subjectId) return false;
        if (filters.onlyFavorites && !card.isFavorite) return false;
        if (filters.onlyPinned && !card.isPinned) return false;
        if (filters.onlyHighImportance && card.importance === 'normal') return false;
        if (filters.tag && !card.tags.includes(filters.tag)) return false;

        if (terms.length > 1) {
          return terms.every((t) => card.searchTokens.some((tok) => tok.startsWith(t)));
        }
        return true;
      })
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  async logReview(log: ReviewLog): Promise<void> {
    await db.transaction('rw', db.reviewLogs, db.cardsMeta, async () => {
      await db.reviewLogs.put(log);
      const card = await db.cardsMeta.get(log.cardId);
      if (card) {
        const sm2 = calculateSm2({
          easeFactor: card.easeFactor,
          intervalDays: card.intervalDays,
          repetitions: card.repetitions,
          confidence: log.confidence,
          now: log.reviewedAt,
        });
        await db.cardsMeta.update(log.cardId, {
          reviewCount: card.reviewCount + 1,
          lastReviewedAt: log.reviewedAt,
          nextReviewAt: sm2.nextReviewAt,
          easeFactor: sm2.easeFactor,
          intervalDays: sm2.intervalDays,
          repetitions: sm2.repetitions,
          updatedAt: Date.now(),
        });
      }
    });
  }

  async listReviewLogs(cardId?: string, limit = 50): Promise<ReviewLog[]> {
    const query = cardId
      ? db.reviewLogs.where('cardId').equals(cardId)
      : db.reviewLogs.orderBy('reviewedAt');
    return query.reverse().limit(limit).toArray();
  }

  async logStudySession(session: StudySession): Promise<void> {
    await db.studySessions.put(session);
  }

  async listStudySessions(limit = 500): Promise<StudySession[]> {
    return db.studySessions.orderBy('startedAt').reverse().limit(limit).toArray();
  }

  async listCanvasStrokes(workspaceId: string): Promise<CanvasStroke[]> {
    const rows = await db.canvasStrokes
      .where('workspaceId')
      .equals(workspaceId)
      .filter((s) => s.deletedAt === null)
      .toArray();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }

  async saveCanvasStroke(stroke: CanvasStroke): Promise<void> {
    await db.canvasStrokes.put(stroke);
  }

  async deleteCanvasStroke(strokeId: string): Promise<void> {
    await db.canvasStrokes.update(strokeId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'pending_push',
    });
  }

  async clearWorkspaceStrokes(workspaceId: string): Promise<void> {
    const now = Date.now();
    const rows = await db.canvasStrokes
      .where('workspaceId')
      .equals(workspaceId)
      .filter((s) => s.deletedAt === null)
      .toArray();
    await db.canvasStrokes.bulkPut(
      rows.map((r) => ({ ...r, deletedAt: now, updatedAt: now, syncStatus: 'pending_push' as const }))
    );
  }
}