import { IKnowledgeRepository } from './interfaces';
import { DexieKnowledgeRepository } from './dexie/dexieKnowledgeRepository';

let instance: IKnowledgeRepository | null = null;

/**
 * Ponto único de injeção de dependência.
 * Na Fase 2 (Supabase), basta instanciar um HybridSyncRepository(dexie, supabase) aqui.
 */
export function getKnowledgeRepository(): IKnowledgeRepository {
  if (!instance) {
    instance = new DexieKnowledgeRepository();
  }
  return instance;
}