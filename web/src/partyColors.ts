export const PARTY_COLORS: Record<string, string> = {
  PT: '#c0122d',
  PSD: '#ffa300',
  'UNIÃO': '#00a0df',
  PL: '#30306c',
  PP: '#54b8ea',
  REPUBLICANOS: '#005ca9',
  MDB: '#009959',
  PDT: '#e70641',
  PSB: '#ecdb00',
  PSDB: '#0f2bc5',
  NOVO: '#ed7021',
  PODE: '#00d663',
  SOLIDARIEDADE: '#f6af04',
  AVANTE: '#ed5f36',
  PRTB: '#0047ab',
  PCO: '#ce1920',
  PSTU: '#c92127',
  PCB: '#a8231c',
  PSOL: '#68018d',
  REDE: '#3ca08c',
  CIDADANIA: '#ec008c',
  DC: '#c89721',
  PMB: '#8d6e63',
  PRD: '#007c3c',
  MOBILIZA: '#da010a',
  'PC do B': '#800314',
  UP: '#212121',
  PMN: '#fdd835',
  AGIR: '#0033a1',
  PV: '#01652f',
}

const NORMALIZED: Record<string, string> = Object.fromEntries(
  Object.entries(PARTY_COLORS).map(([sigla, cor]) => [sigla.toUpperCase(), cor]),
)

export function partyColor(sigla: string, fallback?: string): string {
  return PARTY_COLORS[sigla] ?? NORMALIZED[sigla.trim().toUpperCase()] ?? fallback ?? '#64748b'
}
