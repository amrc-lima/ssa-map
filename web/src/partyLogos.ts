const BASE = import.meta.env.BASE_URL

export function partySlug(sigla: string): string {
  return sigla
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function partyLogo(sigla: string): string {
  return `${BASE}data/partidos/${partySlug(sigla)}.png`
}
