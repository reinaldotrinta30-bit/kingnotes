import { getKnowledgeRepository } from '../repositoryFactory';
import { buildSearchTokens } from '@/domains/search/utils/tokenizer';
import {
  CanvasConnection,
  CanvasNodePosition,
  HierarchyNode,
  KnowledgeCardContent,
  KnowledgeCardMeta,
  Workspace,
} from '@/domains/knowledge/types';

export async function ensureSeedData(): Promise<string> {
  const repo = getKnowledgeRepository();
  const existing = await repo.listWorkspaces();
  if (existing.length > 0) return existing[0].id;

  const now = Date.now();
  const workspaceId = 'ws-concursos-core';

  const workspace: Workspace = {
    id: workspaceId,
    name: 'Carreiras Federais & Tribunais',
    icon: '⚖️',
    color: '#6366f1',
    description: 'Base permanente de legislação, jurisprudência e mapas mentais.',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local_only',
    version: 1,
  };
  await repo.saveWorkspace(workspace);

  const hierarchy: HierarchyNode[] = [
    { id: 'disc-prev', workspaceId, parentId: null, level: 'discipline', title: 'Direito Previdenciário', order: 1, color: '#6366f1', createdAt: now, updatedAt: now, deletedAt: null, syncStatus: 'local_only', version: 1 },
    { id: 'subj-seg', workspaceId, parentId: 'disc-prev', level: 'subject', title: 'Seguridade Social (Art. 194-195 CF)', order: 1, createdAt: now, updatedAt: now, deletedAt: null, syncStatus: 'local_only', version: 1 },
    { id: 'sub-princ', workspaceId, parentId: 'subj-seg', level: 'subsubject', title: 'Princípios Constitucionais', order: 1, createdAt: now, updatedAt: now, deletedAt: null, syncStatus: 'local_only', version: 1 },
    { id: 'top-trip', workspaceId, parentId: 'sub-princ', level: 'topic', title: 'Tripé da Seguridade e Financiamento', order: 1, createdAt: now, updatedAt: now, deletedAt: null, syncStatus: 'local_only', version: 1 },
    { id: 'disc-adm', workspaceId, parentId: null, level: 'discipline', title: 'Direito Administrativo', order: 2, color: '#10b981', createdAt: now, updatedAt: now, deletedAt: null, syncStatus: 'local_only', version: 1 },
    { id: 'subj-atos', workspaceId, parentId: 'disc-adm', level: 'subject', title: 'Atos Administrativos', order: 1, createdAt: now, updatedAt: now, deletedAt: null, syncStatus: 'local_only', version: 1 },
  ];

  for (const h of hierarchy) await repo.saveHierarchyNode(h);

  const card1Meta: KnowledgeCardMeta = {
    id: 'card-tripe-seguridade',
    workspaceId,
    disciplineId: 'disc-prev',
    subjectId: 'subj-seg',
    subsubjectId: 'sub-princ',
    topicId: 'top-trip',
    title: 'Tripé da Seguridade Social (Art. 194 CF)',
    excerpt: 'Saúde (universal, não contributiva), Previdência (contributiva e filiação obrigatória) e Assistência Social (a quem necessitar).',
    notes: 'Pegadinha clássica CESPE/CEBRASPE: Saúde e Assistência independem de contribuição.',
    tags: ['art-194', 'principios', 'cebraspe', 'alta-incidencia'],
    color: 'violet',
    isFavorite: true,
    isPinned: true,
    importance: 'critical',
    reviewCount: 3,
    lastReviewedAt: now - 86400000 * 2,
    nextReviewAt: now + 86400000,
    outgoingLinkIds: ['card-financiamento'],
    searchTokens: buildSearchTokens([
      'Tripé da Seguridade Social Art 194 CF',
      'Direito Previdenciário',
      'Saúde Previdência Assistência Social contributiva',
      'cebraspe pegadinha',
    ]),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local_only',
    version: 1,
  };

  const card1Content: KnowledgeCardContent = {
    cardId: card1Meta.id,
    plainText: 'A seguridade social compreende um conjunto integrado de ações destinadas a assegurar Saúde, Previdência e Assistência Social.',
    tiptapJson: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Conceito Constitucional (Art. 194)' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Conjunto integrado de ações de iniciativa dos Poderes Públicos e da sociedade destinado a assegurar: ' },
            { type: 'text', marks: [{ type: 'highlight' }], text: 'Saúde, Previdência e Assistência Social' },
            { type: 'text', text: '.' },
          ],
        },
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saúde: Direito de todos e dever do Estado (não contributiva).' }] }] },
            { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Previdência: Caráter contributivo e filiação obrigatória.' }] }] },
            { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Revisar Súmulas do STJ sobre BPC/LOAS.' }] }] },
          ],
        },
      ],
    },
    flashcards: [
      {
        id: 'fc-1',
        front: 'Qual ramo da Seguridade Social exige contribuição prévia?',
        back: 'Apenas a Previdência Social (caráter contributivo e filiação obrigatória).',
        easeFactor: 2.5,
        intervalDays: 3,
        nextReviewAt: now,
      },
    ],
    attachments: [],
    updatedAt: now,
  };

  const card2Meta: KnowledgeCardMeta = {
    id: 'card-financiamento',
    workspaceId,
    disciplineId: 'disc-prev',
    subjectId: 'subj-seg',
    subsubjectId: 'sub-princ',
    topicId: 'top-trip',
    title: 'Princípio da Precedência da Fonte de Custeio',
    excerpt: 'Art. 195, §5º CF: Nenhum benefício ou serviço da seguridade social poderá ser criado, majorado ou estendido sem a correspondente fonte de custeio total.',
    notes: 'Regra da Contrapartida. Aplica-se também à criação de novos benefícios assistenciais.',
    tags: ['art-195', 'custeio', 'lei-seca'],
    color: 'sky',
    isFavorite: false,
    isPinned: false,
    importance: 'high',
    reviewCount: 1,
    lastReviewedAt: now - 86400000 * 5,
    nextReviewAt: now - 3600000, // Vencido para aparecer na fila de Revisão Rápida
    outgoingLinkIds: [],
    searchTokens: buildSearchTokens([
      'Princípio da Precedência da Fonte de Custeio',
      'Art 195 paragrafo 5 contrapartida seguridade beneficio',
    ]),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local_only',
    version: 1,
  };

  const card2Content: KnowledgeCardContent = {
    cardId: card2Meta.id,
    plainText: 'Nenhum benefício ou serviço da seguridade social poderá ser criado, majorado ou estendido sem a correspondente fonte de custeio total.',
    tiptapJson: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Art. 195, § 5º da CF/88 — Regra da Contrapartida: nenhum benefício pode ser criado, majorado ou estendido sem a correspondente fonte de custeio total.' }] },
      ],
    },
    flashcards: [
      {
        id: 'fc-2',
        front: 'O que estabelece a Regra da Contrapartida (Art. 195, §5º)?',
        back: 'Nenhum benefício ou serviço da seguridade pode ser criado, majorado ou estendido sem a correspondente fonte de custeio total.',
        easeFactor: 2.5,
        intervalDays: 1,
        nextReviewAt: now,
      },
    ],
    attachments: [],
    updatedAt: now,
  };

  await repo.saveCard(card1Meta, card1Content);
  await repo.saveCard(card2Meta, card2Content);

  const nodes: CanvasNodePosition[] = [
    { id: 'grp-prev-1', workspaceId, nodeType: 'group', label: 'Núcleo Constitucional — Seguridade', color: '#6366f1', x: 60, y: 60, width: 780, height: 340, createdAt: now, updatedAt: now, deletedAt: null, syncStatus: 'local_only', version: 1 },
    { id: 'node-1', workspaceId, cardId: card1Meta.id, groupId: 'grp-prev-1', nodeType: 'knowledgeCard', x: 100, y: 120, width: 320, height: 210, createdAt: now, updatedAt: now, deletedAt: null, syncStatus: 'local_only', version: 1 },
    { id: 'node-2', workspaceId, cardId: card2Meta.id, groupId: 'grp-prev-1', nodeType: 'knowledgeCard', x: 480, y: 120, width: 320, height: 210, createdAt: now, updatedAt: now, deletedAt: null, syncStatus: 'local_only', version: 1 },
  ];
  await repo.upsertCanvasNodes(nodes);

  const edge: CanvasConnection = {
    id: 'edge-1',
    workspaceId,
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    label: 'depende de custeio',
    style: 'animated',
    color: '#818cf8',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local_only',
    version: 1,
  };
  await repo.saveCanvasConnection(edge);

  return workspaceId;
}