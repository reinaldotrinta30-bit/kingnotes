export type StarNoteCategory = 'washi' | 'badges' | 'decor';

export interface StarNoteStickerItem {
  id: string;
  name: string;
  category: StarNoteCategory;
  width: number;
  height: number;
  supportsColor: boolean;
  defaultColor: string;
  buildSvg: (color: string) => string;
}

export const STICKER_PALETTE = [
  { label: 'Índigo', hex: '#6366f1' },
  { label: 'Azul', hex: '#0ea5e9' },
  { label: 'Verde', hex: '#10b981' },
  { label: 'Âmbar', hex: '#f59e0b' },
  { label: 'Rosa', hex: '#f43f5e' },
  { label: 'Roxo', hex: '#a855f7' },
  { label: 'Coral', hex: '#f97316' },
  { label: 'Grafite', hex: '#1e293b' },
];

export const STARNOTE_STICKERS: StarNoteStickerItem[] = [
  // --- FITAS WASHI (WASHI TAPES) ---
  {
    id: 'washi-plain',
    name: 'Washi Lisa',
    category: 'washi',
    width: 170,
    height: 44,
    supportsColor: true,
    defaultColor: '#f59e0b',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 56" width="220" height="56">
        <path d="M 10,8 L 210,8 L 204,16 L 212,24 L 205,33 L 211,42 L 206,49 L 12,49 L 17,40 L 9,31 L 16,22 L 8,14 Z"
          fill="${c}" fill-opacity="0.58" stroke="${c}" stroke-opacity="0.35" stroke-width="1.5"/>
        <path d="M 18,15 L 200,15" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2" stroke-linecap="round"/>
      </svg>`.trim(),
  },
  {
    id: 'washi-striped',
    name: 'Washi Listrada',
    category: 'washi',
    width: 170,
    height: 44,
    supportsColor: true,
    defaultColor: '#f43f5e',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 56" width="220" height="56">
        <defs>
          <pattern id="ws-st" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="16" height="16" fill="${c}" fill-opacity="0.52"/>
            <rect width="6" height="16" fill="#ffffff" fill-opacity="0.35"/>
          </pattern>
        </defs>
        <path d="M 10,8 L 210,8 L 204,16 L 212,24 L 205,33 L 211,42 L 206,49 L 12,49 L 17,40 L 9,31 L 16,22 L 8,14 Z"
          fill="url(#ws-st)" stroke="${c}" stroke-opacity="0.4" stroke-width="1.5"/>
      </svg>`.trim(),
  },
  {
    id: 'washi-dots',
    name: 'Washi Bolinhas',
    category: 'washi',
    width: 170,
    height: 44,
    supportsColor: true,
    defaultColor: '#0ea5e9',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 56" width="220" height="56">
        <defs>
          <pattern id="ws-dt" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="${c}" fill-opacity="0.55"/>
            <circle cx="9" cy="9" r="3" fill="#ffffff" fill-opacity="0.55"/>
          </pattern>
        </defs>
        <path d="M 10,8 L 210,8 L 204,16 L 212,24 L 205,33 L 211,42 L 206,49 L 12,49 L 17,40 L 9,31 L 16,22 L 8,14 Z"
          fill="url(#ws-dt)" stroke="${c}" stroke-opacity="0.35" stroke-width="1.5"/>
      </svg>`.trim(),
  },
  {
    id: 'washi-corner',
    name: 'Fita de Canto',
    category: 'washi',
    width: 110,
    height: 110,
    supportsColor: true,
    defaultColor: '#10b981',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <g transform="rotate(-45 60 60)">
          <path d="M 6,42 L 114,42 L 109,50 L 115,60 L 109,70 L 113,78 L 8,78 L 13,69 L 6,60 L 12,51 Z"
            fill="${c}" fill-opacity="0.6" stroke="${c}" stroke-opacity="0.4" stroke-width="1.5"/>
        </g>
      </svg>`.trim(),
  },

  // --- SELOS & MARCADORES DE ESTUDO ---
  {
    id: 'badge-pegadinha',
    name: 'Selo Pegadinha',
    category: 'badges',
    width: 168,
    height: 54,
    supportsColor: true,
    defaultColor: '#f43f5e',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 68" width="210" height="68">
        <rect x="6" y="6" width="198" height="56" rx="14" fill="${c}" fill-opacity="0.16" stroke="${c}" stroke-width="3"/>
        <rect x="12" y="12" width="186" height="44" rx="10" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="5 4" stroke-opacity="0.7"/>
        <polygon points="34,20 48,46 20,46" fill="#f59e0b" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>
        <rect x="32.5" y="29" width="3" height="9" rx="1.5" fill="#18181b"/>
        <circle cx="34" cy="42" r="2" fill="#18181b"/>
        <text x="122" y="40" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="800" letter-spacing="1.2" fill="${c}">PEGADINHA!</text>
      </svg>`.trim(),
  },
  {
    id: 'badge-prova',
    name: 'Cai em Prova',
    category: 'badges',
    width: 168,
    height: 54,
    supportsColor: true,
    defaultColor: '#f59e0b',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 68" width="210" height="68">
        <rect x="6" y="6" width="198" height="56" rx="28" fill="${c}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>
        <path d="M 33,20 L 36.8,28.5 L 46,29.5 L 39,35.8 L 41,45 L 33,40.2 L 25,45 L 27,35.8 L 20,29.5 L 29.2,28.5 Z" fill="#ffffff"/>
        <text x="122" y="40" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16.5" font-weight="800" letter-spacing="0.8" fill="#ffffff">CAI EM PROVA</text>
      </svg>`.trim(),
  },
  {
    id: 'badge-leiseca',
    name: 'Selo Lei Seca',
    category: 'badges',
    width: 158,
    height: 52,
    supportsColor: true,
    defaultColor: '#6366f1',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 66" width="200" height="66">
        <rect x="6" y="6" width="188" height="54" rx="12" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="3"/>
        <text x="100" y="40" text-anchor="middle" font-family="Georgia, serif" font-size="19" font-weight="700" letter-spacing="1" fill="${c}">§ LEI SECA</text>
      </svg>`.trim(),
  },
  {
    id: 'badge-check',
    name: 'Certo (Check)',
    category: 'badges',
    width: 68,
    height: 68,
    supportsColor: false,
    defaultColor: '#10b981',
    buildSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
        <rect x="8" y="8" width="64" height="64" rx="16" fill="#10b981" stroke="#065f46" stroke-width="3"/>
        <path d="M 22,42 L 35,55 L 59,26" fill="none" stroke="#ffffff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`.trim(),
  },
  {
    id: 'badge-cross',
    name: 'Errado (X)',
    category: 'badges',
    width: 68,
    height: 68,
    supportsColor: false,
    defaultColor: '#f43f5e',
    buildSvg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
        <rect x="8" y="8" width="64" height="64" rx="16" fill="#f43f5e" stroke="#9f1239" stroke-width="3"/>
        <path d="M 25,25 L 55,55 M 55,25 L 25,55" fill="none" stroke="#ffffff" stroke-width="7.5" stroke-linecap="round"/>
      </svg>`.trim(),
  },
  {
    id: 'badge-star',
    name: 'Estrela Caderno',
    category: 'badges',
    width: 82,
    height: 82,
    supportsColor: true,
    defaultColor: '#f59e0b',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
        <path d="M 48,10 L 58,34 L 84,36 L 64,53 L 70,79 L 48,65 L 26,79 L 32,53 L 12,36 L 38,34 Z"
          fill="${c}" stroke="#1e293b" stroke-width="3.2" stroke-linejoin="round"/>
        <circle cx="40" cy="44" r="2.6" fill="#1e293b"/>
        <circle cx="56" cy="44" r="2.6" fill="#1e293b"/>
        <path d="M 43,52 Q 48,57 53,52" fill="none" stroke="#1e293b" stroke-width="2.6" stroke-linecap="round"/>
      </svg>`.trim(),
  },

  // --- ORNAMENTOS DE TÍTULO & ESQUEMAS ---
  {
    id: 'decor-rays-left',
    name: 'Raios Esq.',
    category: 'decor',
    width: 72,
    height: 72,
    supportsColor: true,
    defaultColor: '#f59e0b',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
        <path d="M 60,18 L 22,12 M 64,40 L 14,40 M 60,62 L 22,68"
          fill="none" stroke="${c}" stroke-width="5.5" stroke-linecap="round"/>
      </svg>`.trim(),
  },
  {
    id: 'decor-rays-right',
    name: 'Raios Dir.',
    category: 'decor',
    width: 72,
    height: 72,
    supportsColor: true,
    defaultColor: '#f59e0b',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
        <path d="M 20,18 L 58,12 M 16,40 L 66,40 M 20,62 L 58,68"
          fill="none" stroke="${c}" stroke-width="5.5" stroke-linecap="round"/>
      </svg>`.trim(),
  },
  {
    id: 'decor-brace-left',
    name: 'Chave { Esquema',
    category: 'decor',
    width: 56,
    height: 150,
    supportsColor: true,
    defaultColor: '#6366f1',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 180" width="60" height="180">
        <path d="M 46,10 C 26,10 28,28 28,58 C 28,78 24,88 12,90 C 24,92 28,102 28,122 C 28,152 26,170 46,170"
          fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`.trim(),
  },
  {
    id: 'decor-brace-right',
    name: 'Chave } Esquema',
    category: 'decor',
    width: 56,
    height: 150,
    supportsColor: true,
    defaultColor: '#6366f1',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 180" width="60" height="180">
        <path d="M 14,10 C 34,10 32,28 32,58 C 32,78 36,88 48,90 C 36,92 32,102 32,122 C 32,152 34,170 14,170"
          fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`.trim(),
  },
  {
    id: 'decor-underline-brush',
    name: 'Traço Pincel',
    category: 'decor',
    width: 240,
    height: 34,
    supportsColor: true,
    defaultColor: '#f43f5e',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 40" width="280" height="40">
        <path d="M 12,24 Q 140,10 268,21" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
        <path d="M 38,31 Q 140,22 242,29" fill="none" stroke="${c}" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round"/>
      </svg>`.trim(),
  },
  {
    id: 'decor-curved-arrow',
    name: 'Seta Solta',
    category: 'decor',
    width: 120,
    height: 92,
    supportsColor: true,
    defaultColor: '#0ea5e9',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 100" width="140" height="100">
        <path d="M 14,76 Q 52,16 122,42" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
        <path d="M 103,26 Q 114,36 124,43 Q 110,48 98,55" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`.trim(),
  },
  {
    id: 'decor-sparkles',
    name: 'Brilhos / Estrelas',
    category: 'decor',
    width: 96,
    height: 84,
    supportsColor: true,
    defaultColor: '#f59e0b',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 96" width="110" height="96">
        <path d="M 46,12 Q 48,40 74,44 Q 48,48 46,76 Q 44,48 18,44 Q 44,40 46,12 Z" fill="${c}"/>
        <path d="M 86,14 Q 87,26 98,28 Q 87,30 86,42 Q 85,30 74,28 Q 85,26 86,14 Z" fill="${c}" fill-opacity="0.8"/>
        <circle cx="84" cy="70" r="5" fill="${c}" fill-opacity="0.65"/>
      </svg>`.trim(),
  },
  {
    id: 'decor-divider-stars',
    name: 'Divisória Estrelas',
    category: 'decor',
    width: 240,
    height: 36,
    supportsColor: true,
    defaultColor: '#a855f7',
    buildSvg: (c) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 42" width="280" height="42">
        <line x1="12" y1="21" x2="108" y2="21" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 6"/>
        <path d="M 140,7 L 144,16 L 154,17 L 146,24 L 148,34 L 140,29 L 132,34 L 134,24 L 126,17 L 136,16 Z" fill="${c}"/>
        <line x1="172" y1="21" x2="268" y2="21" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 6"/>
      </svg>`.trim(),
  },
];

// Atalhos rápidos em português para a Biblioteca Universal Iconify
export const ICONIFY_QUICK_CHIPS: Array<{ label: string; query: string }> = [
  { label: 'Direito', query: 'balance scale gavel' },
  { label: 'Livros', query: 'books notebook' },
  { label: 'Cérebro', query: 'brain' },
  { label: 'Alvo', query: 'target bullseye' },
  { label: 'Lupa', query: 'magnifying glass' },
  { label: 'Troféu', query: 'trophy medal' },
  { label: 'Lâmpada', query: 'light bulb' },
  { label: 'Mapa', query: 'globe map' },
  { label: 'Dinheiro', query: 'money coins' },
  { label: 'Escudo', query: 'shield police' },
  { label: 'Checklist', query: 'clipboard check' },
  { label: 'Computador', query: 'laptop computer' },
  { label: 'Pessoas', query: 'people team' },
  { label: 'Alerta', query: 'warning alert' },
];

export type IconifyCollectionFilter = 'color' | 'minimal' | 'all';

export const ICONIFY_COLLECTION_PREFIXES: Record<IconifyCollectionFilter, string> = {
  color: 'fluent-emoji,noto,flat-color-icons,openmoji,twemoji',
  minimal: 'lucide,solar,tabler,ph',
  all: '',
};

const PT_TO_EN_MAP: Record<string, string> = {
  direito: 'justice scale',
  balanca: 'balance scale',
  balança: 'balance scale',
  martelo: 'gavel',
  juiz: 'gavel judge',
  lei: 'law book',
  livro: 'book',
  livros: 'books',
  caderno: 'notebook',
  estudo: 'study graduation',
  formatura: 'graduation cap',
  cerebro: 'brain',
  cérebro: 'brain',
  ideia: 'light bulb',
  lampada: 'light bulb',
  lâmpada: 'light bulb',
  alvo: 'target bullseye',
  lupa: 'magnifying glass',
  busca: 'search magnifying',
  trofeu: 'trophy',
  troféu: 'trophy',
  medalha: 'medal',
  mapa: 'map globe',
  globo: 'globe earth',
  brasil: 'brazil flag',
  bandeira: 'flag',
  dinheiro: 'money coins',
  moeda: 'coin dollar',
  banco: 'bank building',
  escudo: 'shield',
  policia: 'police badge',
  polícia: 'police badge',
  computador: 'laptop computer',
  informatica: 'computer laptop',
  informática: 'computer laptop',
  calculadora: 'calculator',
  matematica: 'calculator math',
  matemática: 'calculator math',
  relogio: 'clock timer',
  relógio: 'clock timer',
  prazo: 'calendar clock',
  calendario: 'calendar',
  calendário: 'calendar',
  pessoa: 'person user',
  pessoas: 'people team',
  equipe: 'team people',
  coracao: 'heart',
  coração: 'heart',
  estrela: 'star',
  fogo: 'fire flame',
  alerta: 'warning alert',
  atencao: 'warning exclamation',
  atenção: 'warning exclamation',
  grafico: 'chart graph',
  gráfico: 'chart graph',
  quebra: 'puzzle',
  peca: 'puzzle',
  peça: 'puzzle',
  lapis: 'pencil',
  lápis: 'pencil',
  caneta: 'pen',
  pasta: 'folder',
  documento: 'document file',
  checklist: 'clipboard check',
  prancheta: 'clipboard',
  seta: 'arrow',
  nuvem: 'cloud',
  casa: 'house home',
  predio: 'building office',
  prédio: 'building office',
  governo: 'classical building',
  coluna: 'pillar classical',
  historia: 'classical scroll',
  história: 'classical scroll',
};

/** Traduz termos comuns de estudo em PT-BR para melhorar os resultados no Iconify */
export function translateStudyQueryToIconify(raw: string): string {
  const clean = raw.trim().toLowerCase();
  if (!clean) return 'study book';
  if (PT_TO_EN_MAP[clean]) return PT_TO_EN_MAP[clean];

  const translated = clean
    .split(/\s+/)
    .map((word) => PT_TO_EN_MAP[word] ?? word)
    .join(' ');
  return translated;
}