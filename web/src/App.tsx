import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl'
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import { SearchSelect } from './SearchSelect'
import type { SearchOption } from './SearchSelect'
import { partyColor } from './partyColors'

setWorkerUrl(workerUrl)

const BASE = import.meta.env.BASE_URL

type Candidato = {
  id: string
  nome: string
  nome_urna: string
  numero: string
  cargo_id: string
  cargo: string
  partido: string
  partido_nome: string
  partido_numero: string
  agremiacao: string
  agremiacao_nome: string
  agremiacao_tipo: 'PARTIDO' | 'FEDERA├ç├âO'
  agremiacao_votos: number | null
  agremiacao_qp: number | null
  coeficiente: number | null
  limite_10: number | null
  cor: string
  votos_total: number
  votos_max_bairro: number
  bairros_com_voto: number
  situacao: string
  resultado: string
  status: string
  status_label: string
  status_detalhe: string
  eleito: boolean
  suplente: boolean
  eleito_por: string | null
  foto?: string | null
}

type Cargo = { id: string; nome: string; candidatos: Candidato[] }

type Meta = {
  municipio: string
  ano: number
  turno?: number
  gerado_em?: string
  fonte?: string
  bairros: number
  candidatos: number
  secoes_total: number
  secoes_com_coordenada: number
  secoes_mapeadas: number
  secoes_por_alias?: number
  secoes_por_nome_prioritario?: number
  secoes_por_coordenada: number
  secoes_por_nome: number
  secoes_sem_bairro: number
  locais_distintos: number
  votos_candidatos: number
  votos_legenda?: number
  votos_legenda_bairro?: number
  votos_atribuidos_bairro: number
  cobertura_votos: number
  max_votos_bairro: number
  cadeiras_vereador?: number
  votos_validos_vereador?: number
  coeficiente_eleitoral?: number
  limite_10_coeficiente?: number
}

type BairroMeta = {
  id: number
  nome: string
  votos_candidatos: number
  qualidade_coordenada: number | null
}

type CandidatosDoc = { meta: Meta; cargos: Cargo[] }
type VotosDoc = {
  meta: Meta
  bairros: BairroMeta[]
  por_candidato: Record<string, Record<string, number>>
  legenda?: Record<string, Record<string, number>>
  legenda_total?: Record<string, number>
}

type BairroFeature = {
  type: 'Feature'
  properties: { id?: number; nome?: string }
  geometry: { type: string; coordinates: unknown }
}
type BairroCollection = { type: 'FeatureCollection'; features: BairroFeature[] }

type Modo = 'global' | 'relativo' | 'rankeada'
type Visao = 'mapa' | 'campeoes'
type CampeaoCargo = '11' | '13'
type CampeaoAba = 'candidatos' | 'bairros'
type StatusTone = 'eleito' | 'coeficiente' | 'nao' | 'alerta'

type PartidoResumo = {
  sigla: string
  nome: string
  numero: string
  cor: string
  votos_total: number
  candidatos: number
  eleitos: number
}

type TopItem = {
  candidato: Candidato
  votos: number
  total: number
  pct: number
}

type Selecao = {
  tipo: 'candidato' | 'partido' | 'total'
  cor: string
  rotulo: string
  votos: Record<string, number>
  denomRel: number
  denomGlobal: number
  pctGlobalMax: number
}

type Resumo = {
  cor: string
  titulo: string
  linha: string
  nota: string
  status?: string
  statusTone?: StatusTone
  statusDetalhe?: string
}

const nf = new Intl.NumberFormat('pt-BR')

function pctText(value: number) {
  return `${(value * 100).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`
}

function normalizar(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function statusTone(status: string): StatusTone {
  if (status === 'eleito' || status === 'eleito_proprios') return 'eleito'
  if (status === 'eleito_coeficiente') return 'coeficiente'
  if (status === 'nao_eleito_10' || status === 'nao_eleito_partido') return 'alerta'
  return 'nao'
}

function statusRingColor(candidato: Candidato) {
  if (candidato.resultado === '#NULO') return '#991b1b'
  if (candidato.status === 'eleito' || candidato.status === 'eleito_proprios') return '#16a34a'
  if (candidato.status === 'eleito_coeficiente') return '#d97706'
  if (candidato.status === 'nao_eleito_10' || candidato.status === 'nao_eleito_partido') {
    return '#dc2626'
  }
  return '#64748b'
}

function ringTitle(candidato: Candidato) {
  if (candidato.resultado === '#NULO') {
    return 'Sem resultado eleitoral (indeferido, cassado ou ren├║ncia)'
  }
  return candidato.status_label
}

function statusBadge(candidato: Candidato): { badge: string; tone: StatusTone } {
  switch (candidato.status) {
    case 'eleito_proprios':
      return { badge: 'Pr├│prios', tone: 'eleito' }
    case 'eleito_coeficiente':
      return { badge: 'Coef.', tone: 'coeficiente' }
    case 'eleito':
      return { badge: 'Eleito', tone: 'eleito' }
    case 'nao_eleito_10':
      return { badge: '<10%', tone: 'alerta' }
    case 'nao_eleito_partido':
      return { badge: 'Partido', tone: 'alerta' }
    case 'nao_eleito':
      return { badge: candidato.suplente ? 'Suplente' : 'N├úo eleito', tone: 'nao' }
    default:
      return { badge: '', tone: 'nao' }
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function popupMarkup(nome: string, linha: string, nota?: string) {
  return `<div class="pop"><strong>${escapeHtml(nome)}</strong><div>${escapeHtml(linha)}</div>${
    nota ? `<div class="pop-note">${escapeHtml(nota)}</div>` : ''
  }</div>`
}

function hoverMarkup(nome: string, linha: string) {
  return `<div class="pop pop-hover"><strong>${escapeHtml(nome)}</strong><div>${escapeHtml(
    linha,
  )}</div></div>`
}

function extendBounds(bounds: LngLatBounds, geometry: BairroFeature['geometry']) {
  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      bounds.extend(coords as [number, number])
      return
    }
    coords.forEach(walk)
  }
  walk(geometry.coordinates)
}

function makeHatchImage() {
  const size = 8
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D indispon├¡vel')
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 1.1
  for (const offset of [-size, 0, size]) {
    ctx.beginPath()
    ctx.moveTo(offset - 2, size + 2)
    ctx.lineTo(offset + size + 2, -2)
    ctx.stroke()
  }
  return ctx.getImageData(0, 0, size, size)
}

function Avatar({
  label,
  fill,
  ring,
  pct,
  title,
  size = 44,
  foto,
}: {
  label: string
  fill: string
  ring: string
  pct: number
  title: string
  size?: number
  foto?: string | null
}) {
  const clamped = Math.max(0, Math.min(1, pct))
  const [erroFoto, setErroFoto] = useState(false)
  useEffect(() => {
    setErroFoto(false)
  }, [foto])
  const src = foto && !erroFoto ? `${BASE}${foto}` : null
  return (
    <span
      className="avatar"
      style={
        {
          '--ring': ring,
          '--fill': src ? 'transparent' : fill,
          '--pct': `${Math.round(clamped * 100)}%`,
          width: size,
          height: size,
        } as CSSProperties
      }
      title={title}
    >
      <span className="avatar-inner">
        {src ? (
          <img src={src} alt={label} loading="lazy" onError={() => setErroFoto(true)} />
        ) : (
          label
        )}
      </span>
    </span>
  )
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const fittedRef = useRef(false)
  const hoverPopupRef = useRef<Popup | null>(null)
  const clickPopupRef = useRef<Popup | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const [geojson, setGeojson] = useState<BairroCollection | null>(null)
  const [candDoc, setCandDoc] = useState<CandidatosDoc | null>(null)
  const [votosDoc, setVotosDoc] = useState<VotosDoc | null>(null)
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  const [cargoId, setCargoId] = useState('')
  const [partidoId, setPartidoId] = useState('')
  const [candidatoId, setCandidatoId] = useState('')
  const [selecoesPorCargo, setSelecoesPorCargo] = useState<
    Record<string, { partidoId: string; candidatoId: string }>
  >({})
  const [modo, setModo] = useState<Modo>('relativo')
  const [visao, setVisao] = useState<Visao>('mapa')
  const [campeaoCargo, setCampeaoCargo] = useState<CampeaoCargo>('13')
  const [campeaoAba, setCampeaoAba] = useState<CampeaoAba>('bairros')
  const [filtroCampeoes, setFiltroCampeoes] = useState('')
  const [bairroSelecionado, setBairroSelecionado] = useState<number | null>(null)
  const [buscaBairro, setBuscaBairro] = useState('')
  const [buscaBairroAberta, setBuscaBairroAberta] = useState(false)
  const [painelOculto, setPainelOculto] = useState(false)
  const [rankingAba, setRankingAba] = useState<'candidatos' | 'partidos'>('candidatos')
  const [rankingOculto, setRankingOculto] = useState(false)

  const cargo = useMemo(
    () => candDoc?.cargos.find((item) => item.id === cargoId) ?? null,
    [candDoc, cargoId],
  )
  const candidato = useMemo(
    () => cargo?.candidatos.find((item) => item.id === candidatoId) ?? null,
    [cargo, candidatoId],
  )
  const rankingCargo = useMemo(() => {
    if (!candDoc) return null
    if (visao === 'campeoes') return candDoc.cargos.find((item) => item.id === campeaoCargo) ?? null
    return cargo
  }, [candDoc, visao, campeaoCargo, cargo])
  const meta = votosDoc?.meta ?? candDoc?.meta ?? null
  const incluirLegenda = cargo?.id === '13'

  const bairrosOrdenados = useMemo(
    () => (votosDoc?.bairros ?? []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [votosDoc],
  )

  const bairrosSemVoto = useMemo(
    () =>
      bairrosOrdenados
        .filter((item) => item.votos_candidatos === 0)
        .map((item) => item.nome),
    [bairrosOrdenados],
  )

  const bairrosBusca = useMemo(() => {
    const termo = normalizar(buscaBairro.trim())
    const lista = termo
      ? bairrosOrdenados.filter((item) => normalizar(item.nome).includes(termo))
      : bairrosOrdenados
    return lista.slice(0, 10)
  }, [bairrosOrdenados, buscaBairro])

  const totaisPorCargo = useMemo(() => {
    const resultado = new Map<string, Record<string, number>>()
    if (!candDoc || !votosDoc) return resultado
    for (const item of candDoc.cargos) {
      const total: Record<string, number> = {}
      for (const candidatoItem of item.candidatos) {
        for (const [bairroId, qtd] of Object.entries(votosDoc.por_candidato[candidatoItem.id] ?? {})) {
          total[bairroId] = (total[bairroId] ?? 0) + qtd
        }
      }
      if (item.id === '13') {
        for (const votosLegenda of Object.values(votosDoc.legenda ?? {})) {
          for (const [bairroId, qtd] of Object.entries(votosLegenda)) {
            total[bairroId] = (total[bairroId] ?? 0) + qtd
          }
        }
      }
      resultado.set(item.id, total)
    }
    return resultado
  }, [candDoc, votosDoc])

  const campeoesPorCargo = useMemo(() => {
    const resultado = new Map<string, { tops: Map<string, TopItem>; maxPct: number }>()
    if (!candDoc || !votosDoc) return resultado
    for (const docCargo of candDoc.cargos) {
      const tops = new Map<string, TopItem>()
      const totais = totaisPorCargo.get(docCargo.id) ?? {}
      for (const item of docCargo.candidatos) {
        for (const [bairroId, qtd] of Object.entries(votosDoc.por_candidato[item.id] ?? {})) {
          const atual = tops.get(bairroId)
          if (
            !atual ||
            qtd > atual.votos ||
            (qtd === atual.votos && item.nome_urna.localeCompare(atual.candidato.nome_urna, 'pt-BR') < 0)
          ) {
            const total = totais[bairroId] ?? 0
            tops.set(bairroId, {
              candidato: item,
              votos: qtd,
              total,
              pct: total > 0 ? qtd / total : 0,
            })
          }
        }
      }
      const maxPct = [...tops.values()].reduce((maior, item) => Math.max(maior, item.pct), 0)
      resultado.set(docCargo.id, { tops, maxPct })
    }
    return resultado
  }, [candDoc, votosDoc, totaisPorCargo])

  const campeaoAtual = campeoesPorCargo.get(campeaoCargo)
  const topsCampeao = useMemo(
    () => campeaoAtual?.tops ?? new Map<string, TopItem>(),
    [campeaoAtual],
  )
  const maxTopPctCampeao = campeaoAtual?.maxPct ?? 0

  const campeoesBairros = useMemo(
    () =>
      bairrosOrdenados.map((item) => ({
        ...item,
        top: topsCampeao.get(String(item.id)),
      })),
    [bairrosOrdenados, topsCampeao],
  )

  const campeoesCandidatos = useMemo(() => {
    const mapa = new Map<
      string,
      { candidato: Candidato; bairros: number; bairrosNomes: string[]; votosMax: number }
    >()
    for (const item of campeoesBairros) {
      if (!item.top) continue
      const atual = mapa.get(item.top.candidato.id) ?? {
        candidato: item.top.candidato,
        bairros: 0,
        bairrosNomes: [],
        votosMax: 0,
      }
      atual.bairros += 1
      atual.votosMax = Math.max(atual.votosMax, item.top.votos)
      if (atual.bairrosNomes.length < 8) atual.bairrosNomes.push(item.nome)
      mapa.set(item.top.candidato.id, atual)
    }
    return [...mapa.values()].sort(
      (a, b) =>
        b.bairros - a.bairros ||
        b.votosMax - a.votosMax ||
        a.candidato.nome_urna.localeCompare(b.candidato.nome_urna, 'pt-BR'),
    )
  }, [campeoesBairros])

  const campeoesBairrosFiltrados = useMemo(() => {
    const termo = normalizar(filtroCampeoes.trim())
    if (!termo) return campeoesBairros
    return campeoesBairros.filter((item) => {
      const alvo = item.top
        ? `${item.nome} ${item.top.candidato.nome_urna} ${item.top.candidato.partido}`
        : item.nome
      return normalizar(alvo).includes(termo)
    })
  }, [campeoesBairros, filtroCampeoes])

  const campeoesCandidatosFiltrados = useMemo(() => {
    const termo = normalizar(filtroCampeoes.trim())
    if (!termo) return campeoesCandidatos
    return campeoesCandidatos.filter((item) =>
      normalizar(
        `${item.candidato.nome_urna} ${item.candidato.partido} ${item.bairrosNomes.join(' ')}`,
      ).includes(termo),
    )
  }, [campeoesCandidatos, filtroCampeoes])

  const topPartidosCampeao = useMemo(() => {
    const mapa = new Map<string, { sigla: string; cor: string; bairros: number }>()
    for (const item of topsCampeao.values()) {
      const cor = partyColor(item.candidato.partido, item.candidato.cor)
      const atual = mapa.get(item.candidato.partido) ?? { sigla: item.candidato.partido, cor, bairros: 0 }
      atual.bairros += 1
      mapa.set(item.candidato.partido, atual)
    }
    return [...mapa.values()].sort(
      (a, b) => b.bairros - a.bairros || a.sigla.localeCompare(b.sigla, 'pt-BR'),
    )
  }, [topsCampeao])

  const partidos = useMemo<PartidoResumo[]>(() => {
    if (!cargo) return []
    const mapa = new Map<string, PartidoResumo>()
    for (const item of cargo.candidatos) {
      const atual = mapa.get(item.partido) ?? {
        sigla: item.partido,
        nome: item.partido_nome,
        numero: item.partido_numero,
        cor: partyColor(item.partido, item.cor),
        votos_total: 0,
        candidatos: 0,
        eleitos: 0,
      }
      atual.votos_total += item.votos_total
      atual.candidatos += 1
      if (item.eleito) atual.eleitos += 1
      mapa.set(item.partido, atual)
    }
    if (incluirLegenda) {
      const legendaTotal = votosDoc?.legenda_total ?? {}
      for (const item of mapa.values()) {
        item.votos_total += legendaTotal[item.sigla] ?? 0
      }
    }
    return [...mapa.values()].sort((a, b) => a.sigla.localeCompare(b.sigla, 'pt-BR'))
  }, [cargo, incluirLegenda, votosDoc])

  const partido = useMemo(
    () => partidos.find((item) => item.sigla === partidoId) ?? null,
    [partidos, partidoId],
  )

  const candidatosDisponiveis = useMemo(() => {
    if (!cargo) return []
    const lista =
      cargoId !== '11' && partidoId
        ? cargo.candidatos.filter((item) => item.partido === partidoId)
        : cargo.candidatos
    return [...lista].sort(
      (a, b) => b.votos_total - a.votos_total || a.nome_urna.localeCompare(b.nome_urna, 'pt-BR'),
    )
  }, [cargo, cargoId, partidoId])

  const agregados = useMemo(() => {
    if (!cargo) return null
    const porPartido = new Map<string, { votos: Record<string, number>; max: number }>()
    const total: Record<string, number> = {}

    for (const item of cargo.candidatos) {
      const votosCandidato = votosDoc?.por_candidato[item.id] ?? {}
      const atual = porPartido.get(item.partido) ?? { votos: {}, max: 0 }
      for (const [bairroId, qtd] of Object.entries(votosCandidato)) {
        atual.votos[bairroId] = (atual.votos[bairroId] ?? 0) + qtd
        total[bairroId] = (total[bairroId] ?? 0) + qtd
      }
      porPartido.set(item.partido, atual)
    }

    if (incluirLegenda) {
      for (const votosLegenda of Object.values(votosDoc?.legenda ?? {})) {
        for (const [bairroId, qtd] of Object.entries(votosLegenda)) {
          total[bairroId] = (total[bairroId] ?? 0) + qtd
        }
      }
      for (const [sigla, votosLegenda] of Object.entries(votosDoc?.legenda ?? {})) {
        const atual = porPartido.get(sigla)
        if (!atual) continue
        for (const [bairroId, qtd] of Object.entries(votosLegenda)) {
          atual.votos[bairroId] = (atual.votos[bairroId] ?? 0) + qtd
        }
      }
    }

    let globalPartyMax = 0
    for (const item of porPartido.values()) {
      item.max = Object.values(item.votos).reduce((maior, valor) => Math.max(maior, valor), 0)
      globalPartyMax = Math.max(globalPartyMax, item.max)
    }
    const totalMax = Object.values(total).reduce((maior, valor) => Math.max(maior, valor), 0)
    return { porPartido, total, globalPartyMax, totalMax }
  }, [cargo, incluirLegenda, votosDoc])

  const escalasPct = useMemo(() => {
    if (!cargo || !agregados || !votosDoc) return { candidato: 0, partido: 0 }
    let candidatoMax = 0
    for (const item of cargo.candidatos) {
      const votosCandidato = votosDoc.por_candidato[item.id] ?? {}
      for (const [bairroId, qtd] of Object.entries(votosCandidato)) {
        const total = agregados.total[bairroId] ?? 0
        if (total > 0) candidatoMax = Math.max(candidatoMax, qtd / total)
      }
    }
    let partidoMax = 0
    for (const item of agregados.porPartido.values()) {
      for (const [bairroId, qtd] of Object.entries(item.votos)) {
        const total = agregados.total[bairroId] ?? 0
        if (total > 0) partidoMax = Math.max(partidoMax, qtd / total)
      }
    }
    return { candidato: candidatoMax, partido: partidoMax }
  }, [cargo, agregados, votosDoc])

  const totalCargo = useMemo(() => {
    if (!cargo) return 0
    const candidatosTotal = cargo.candidatos.reduce((soma, item) => soma + item.votos_total, 0)
    if (!incluirLegenda) return candidatosTotal
    const legendaTotal = Object.values(votosDoc?.legenda_total ?? {}).reduce((soma, valor) => soma + valor, 0)
    return candidatosTotal + legendaTotal
  }, [cargo, incluirLegenda, votosDoc])

  const selecao = useMemo<Selecao | null>(() => {
    if (candidato) {
      return {
        tipo: 'candidato',
        cor: partyColor(candidato.partido, candidato.cor),
        rotulo: candidato.nome_urna,
        votos: votosDoc?.por_candidato[candidato.id] ?? {},
        denomRel: candidato.votos_max_bairro,
        denomGlobal: votosDoc?.meta.max_votos_bairro ?? 0,
        pctGlobalMax: escalasPct.candidato,
      }
    }
    if (partido && agregados) {
      const item = agregados.porPartido.get(partido.sigla)
      if (!item) return null
      return {
        tipo: 'partido',
        cor: partido.cor,
        rotulo: partido.sigla,
        votos: item.votos,
        denomRel: item.max,
        denomGlobal: agregados.globalPartyMax,
        pctGlobalMax: escalasPct.partido,
      }
    }
    if (cargo && agregados) {
      return {
        tipo: 'total',
        cor: '#475569',
        rotulo: 'Total do cargo',
        votos: agregados.total,
        denomRel: agregados.totalMax,
        denomGlobal: agregados.totalMax,
        pctGlobalMax: 0,
      }
    }
    return null
  }, [candidato, partido, agregados, cargo, votosDoc, escalasPct])

  const ranks = useMemo<Record<string, number>>(() => {
    if (!cargo || !selecao || !agregados || !votosDoc) return {}
    const resultado: Record<string, number> = {}
    if (selecao.tipo === 'candidato' && candidato) {
      for (const bairroId of Object.keys(agregados.total)) {
        const alvo = selecao.votos[bairroId] ?? 0
        let acima = 0
        for (const item of cargo.candidatos) {
          const votos = votosDoc.por_candidato[item.id]?.[bairroId] ?? 0
          if (votos > alvo) acima += 1
        }
        resultado[bairroId] = acima + 1
      }
    } else if (selecao.tipo === 'partido' && partido) {
      for (const bairroId of Object.keys(agregados.total)) {
        const alvo = selecao.votos[bairroId] ?? 0
        let acima = 0
        for (const [sigla, item] of agregados.porPartido) {
          if (sigla !== partido.sigla && (item.votos[bairroId] ?? 0) > alvo) acima += 1
        }
        resultado[bairroId] = acima + 1
      }
    }
    return resultado
  }, [cargo, selecao, candidato, partido, agregados, votosDoc])

  const maxPctSelecionadoInfo = useMemo(() => {
    if (!selecao || selecao.tipo === 'total' || !agregados) return { pct: 0, bairroId: null as string | null }
    let max = 0
    let bairroId: string | null = null
    for (const [id, votos] of Object.entries(selecao.votos)) {
      const total = agregados.total[id] ?? 0
      if (total <= 0) continue
      const pct = votos / total
      if (pct > max) {
        max = pct
        bairroId = id
      }
    }
    return { pct: max, bairroId }
  }, [selecao, agregados])

  const maxPctSelecionado = maxPctSelecionadoInfo.pct
  const bairroMaxPct = maxPctSelecionadoInfo.bairroId
    ? (bairrosOrdenados.find((item) => String(item.id) === String(maxPctSelecionadoInfo.bairroId))?.nome ?? '')
    : ''

  const maxVotosSelecionadoInfo = useMemo(() => {
    if (!selecao || selecao.tipo === 'total') return { votos: 0, bairroId: null as string | null }
    let max = 0
    let bairroId: string | null = null
    for (const [id, votos] of Object.entries(selecao.votos)) {
      if (votos > max) {
        max = votos
        bairroId = id
      }
    }
    return { votos: max, bairroId }
  }, [selecao])

  const bairroMaxVotos = maxVotosSelecionadoInfo.bairroId
    ? (bairrosOrdenados.find((item) => String(item.id) === String(maxVotosSelecionadoInfo.bairroId))?.nome ?? '')
    : ''

  const topsCargoAtual = useMemo(
    () => campeoesPorCargo.get(cargoId)?.tops ?? new Map<string, TopItem>(),
    [campeoesPorCargo, cargoId],
  )

  const rankingBairro = useMemo(() => {
    if (bairroSelecionado === null || !rankingCargo || !votosDoc) return null
    const bairro = votosDoc.bairros.find((item) => item.id === bairroSelecionado)
    if (!bairro) return null
    const total = totaisPorCargo.get(rankingCargo.id)?.[String(bairroSelecionado)] ?? 0
    const candidatos = rankingCargo.candidatos
      .map((item) => ({
        candidato: item,
        votos: votosDoc.por_candidato[item.id]?.[String(bairroSelecionado)] ?? 0,
      }))
      .filter((item) => item.votos > 0)
      .sort((a, b) => b.votos - a.votos || a.candidato.nome_urna.localeCompare(b.candidato.nome_urna, 'pt-BR'))
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        pct: total > 0 ? item.votos / total : 0,
      }))

    const partidosMap = new Map<
      string,
      { sigla: string; nome: string; tipo: string; cor: string; votos: number; candidatos: number; legenda: number }
    >()
    for (const item of candidatos) {
      const usarAgremiacao = rankingCargo.id === '13'
      const sigla = usarAgremiacao ? item.candidato.agremiacao : item.candidato.partido
      const nome = usarAgremiacao ? item.candidato.agremiacao_nome : item.candidato.partido_nome
      const tipo = usarAgremiacao ? item.candidato.agremiacao_tipo : 'PARTIDO'
      const atual = partidosMap.get(sigla) ?? {
        sigla,
        nome,
        tipo,
        cor: partyColor(item.candidato.partido, item.candidato.cor),
        votos: 0,
        candidatos: 0,
        legenda: 0,
      }
      atual.votos += item.votos
      atual.candidatos += 1
      partidosMap.set(sigla, atual)
    }
    if (rankingCargo.id === '13') {
      for (const [sigla, votosPorBairro] of Object.entries(votosDoc.legenda ?? {})) {
        const legenda = votosPorBairro[String(bairroSelecionado)] ?? 0
        if (legenda <= 0) continue
        const atual = partidosMap.get(sigla) ?? {
          sigla,
          nome: sigla,
          tipo: 'PARTIDO',
          cor: partyColor(sigla),
          votos: 0,
          candidatos: 0,
          legenda: 0,
        }
        atual.legenda += legenda
        atual.votos += legenda
        partidosMap.set(sigla, atual)
      }
    }
    const partidos = [...partidosMap.values()]
      .sort((a, b) => b.votos - a.votos || a.sigla.localeCompare(b.sigla, 'pt-BR'))
      .map((item, index) => ({
        ...item,
        rank: index + 1,
        pct: total > 0 ? item.votos / total : 0,
      }))

    return { bairro, total, candidatos, partidos }
  }, [bairroSelecionado, rankingCargo, votosDoc, totaisPorCargo])

  const resumo = useMemo<Resumo | null>(() => {
    if (!selecao) return null
    if (selecao.tipo === 'candidato' && candidato) {
      const nota =
        candidato.agremiacao_tipo === 'FEDERA├ç├âO'
          ? candidato.cargo_id === '13'
            ? `Federa├º├úo: ${candidato.agremiacao_nome} ┬À ${nf.format(candidato.agremiacao_votos ?? 0)} votos ┬À ${candidato.agremiacao_qp ?? 0} QP`
            : `Federa├º├úo: ${candidato.agremiacao_nome}`
          : candidato.partido_nome
      return {
        cor: selecao.cor,
        titulo: candidato.nome_urna,
        linha: `${candidato.partido} ┬À ${candidato.cargo} ┬À ${nf.format(candidato.votos_total)} votos`,
        nota,
        status: candidato.status_label,
        statusTone: statusTone(candidato.status),
        statusDetalhe: candidato.status_detalhe,
      }
    }
    if (selecao.tipo === 'partido' && partido) {
      return {
        cor: selecao.cor,
        titulo: `${partido.sigla} ÔÇö ${partido.nome}`,
        linha: `${nf.format(partido.candidatos)} candidato${partido.candidatos > 1 ? 's' : ''} ┬À ${nf.format(partido.votos_total)} votos ┬À ${nf.format(partido.eleitos)} eleito${partido.eleitos === 1 ? '' : 's'}`,
        nota: incluirLegenda ? 'Soma dos candidatos do partido + votos de legenda' : 'Partido com um ├║nico candidato ao cargo',
      }
    }
    return {
      cor: selecao.cor,
      titulo: 'Total do cargo',
      linha: `${nf.format(totalCargo)} votos`,
      nota: incluirLegenda ? 'Candidatos + votos de legenda' : 'Todos os candidatos',
    }
  }, [selecao, candidato, partido, incluirLegenda, totalCargo])

  const partyOptions = useMemo<SearchOption[]>(
    () =>
      partidos.map((item) => ({
        value: item.sigla,
        label: `${item.sigla} ÔÇö ${item.nome} (${item.numero}) ┬À ${nf.format(item.votos_total)}`,
        search: `${item.sigla} ${item.nome} ${item.numero}`,
        color: item.cor,
      })),
    [partidos],
  )

  const candidateOptions = useMemo<SearchOption[]>(
    () =>
      candidatosDisponiveis.map((item) => {
        const badge = statusBadge(item)
        return {
          value: item.id,
          label: `${item.nome_urna} ┬À ${item.partido} (${item.numero}) ┬À ${nf.format(item.votos_total)}`,
          search: `${item.nome} ${item.nome_urna} ${item.partido} ${item.partido_nome} ${item.numero} ${item.status_label} ${item.suplente ? 'suplente' : ''} ${item.eleito ? 'eleito' : 'n├úo eleito'}`,
          color: partyColor(item.partido, item.cor),
          badge: badge.badge,
          tone: badge.tone,
        }
      }),
    [candidatosDisponiveis],
  )

  useEffect(() => {
    let alive = true
    const getJson = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url} ÔåÆ HTTP ${response.status}`)
      return (await response.json()) as T
    }
    Promise.all([
      getJson<BairroCollection>(`${BASE}geo/bairros.geojson`),
      getJson<CandidatosDoc>(`${BASE}data/candidatos.json`),
      getJson<VotosDoc>(`${BASE}data/votos.json`),
    ])
      .then(([bairros, candidatos, votos]) => {
        if (!alive) return
        setGeojson(bairros)
        setCandDoc(candidatos)
        setVotosDoc(votos)
        const firstCargo = candidatos.cargos[0]
        setCargoId(firstCargo?.id ?? '')
        setPartidoId('')
        setCandidatoId('')
      })
      .catch((error) => {
        if (alive) setErro((error as Error).message)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setBuscaBairroAberta(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const map = new MapLibreMap({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-38.5, -12.97],
      zoom: 10.4,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    ;(window as unknown as { __map?: MapLibreMap }).__map = map
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-left')

    map.on('load', () => {
      map.addImage('hatch', makeHatchImage())
      map.addSource('bairros', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'bairros-fill',
        type: 'fill',
        source: 'bairros',
        filter: ['>', ['get', 'votos'], 0],
        paint: {
          'fill-color': '#2563eb',
          'fill-opacity': ['get', 'opacidade'],
          'fill-color-transition': { duration: 450, delay: 0 },
          'fill-opacity-transition': { duration: 450, delay: 0 },
        },
      })
      map.addLayer({
        id: 'bairros-zero',
        type: 'fill',
        source: 'bairros',
        filter: ['==', ['get', 'votos'], 0],
        paint: {
          'fill-pattern': 'hatch',
          'fill-opacity': 0.55,
          'fill-opacity-transition': { duration: 450, delay: 0 },
        },
      })
      map.addLayer({
        id: 'bairros-line',
        type: 'line',
        source: 'bairros',
        paint: {
          'line-color': '#1e293b',
          'line-width': 0.7,
          'line-opacity': 0.7,
          'line-color-transition': { duration: 300, delay: 0 },
        },
      })
      map.addLayer({
        id: 'bairros-selected-halo',
        type: 'line',
        source: 'bairros',
        filter: ['==', ['get', 'id'], -1],
        paint: {
          'line-color': '#fff',
          'line-width': 7,
          'line-opacity': 0.9,
          'line-opacity-transition': { duration: 200, delay: 0 },
        },
      })
      map.addLayer({
        id: 'bairros-selected',
        type: 'line',
        source: 'bairros',
        filter: ['==', ['get', 'id'], -1],
        paint: {
          'line-color': '#f97316',
          'line-width': 3.5,
          'line-opacity': 1,
          'line-opacity-transition': { duration: 200, delay: 0 },
        },
      })

      map.on('click', (event: MapLayerMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, {
          layers: ['bairros-fill', 'bairros-zero'],
        })[0]
        if (!feature) return
        const props = (feature.properties ?? {}) as Record<string, unknown>
        const clickedId = Number(props.id)
        if (Number.isFinite(clickedId)) {
          setBairroSelecionado(clickedId)
          setRankingOculto(false)
          setRankingAba('candidatos')
        }
        const html = String(props.popupHtml ?? '')
        if (!html) return
        clickPopupRef.current?.remove()
        clickPopupRef.current = new Popup({ closeButton: true, maxWidth: '320px' })
          .setLngLat(event.lngLat)
          .setHTML(html)
          .addTo(map)
        hoverPopupRef.current?.remove()
        hoverPopupRef.current = null
      })

      map.on('mousemove', (event: MapLayerMouseEvent) => {
        const hit = map.queryRenderedFeatures(event.point, {
          layers: ['bairros-fill', 'bairros-zero'],
        })
        if (!hit.length) {
          map.getCanvas().style.cursor = ''
          hoverPopupRef.current?.remove()
          hoverPopupRef.current = null
          return
        }
        map.getCanvas().style.cursor = 'pointer'
        const props = (hit[0].properties ?? {}) as Record<string, unknown>
        const html = String(props.hoverHtml ?? '')
        if (!html) return
        let popup = hoverPopupRef.current
        if (!popup) {
          popup = new Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 10,
            className: 'hover-pop',
          })
          hoverPopupRef.current = popup
        }
        popup.setLngLat(event.lngLat).setHTML(html)
        if (!popup.isOpen()) popup.addTo(map)
      })

      map.on('mouseout', () => {
        hoverPopupRef.current?.remove()
        hoverPopupRef.current = null
      })

      setPronto(true)
    })

    return () => {
      hoverPopupRef.current?.remove()
      clickPopupRef.current?.remove()
      hoverPopupRef.current = null
      clickPopupRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    clickPopupRef.current?.remove()
    clickPopupRef.current = null
    hoverPopupRef.current?.remove()
    hoverPopupRef.current = null
  }, [visao, cargoId, partidoId, candidatoId, modo, campeaoCargo])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pronto) return
    const filtro = ['==', ['get', 'id'], bairroSelecionado ?? -1] as never
    if (map.getLayer('bairros-selected-halo')) map.setFilter('bairros-selected-halo', filtro)
    if (map.getLayer('bairros-selected')) map.setFilter('bairros-selected', filtro)
  }, [bairroSelecionado, pronto])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pronto || !geojson || !votosDoc) return

    const qualidade = new Map(votosDoc.bairros.map((item) => [item.id, item.qualidade_coordenada]))

    const features = geojson.features.map((feature) => {
      const id = Number(feature.properties.id)
      const nome = feature.properties.nome ?? ''
      const q = qualidade.get(id) ?? null
      const notaQualidade =
        typeof q === 'number' && q < 0.999
          ? `${Math.round(q * 100)}% das se├º├Áes deste bairro localizadas por coordenada; o restante por nome/aliase do TSE`
          : ''

      if (visao === 'campeoes') {
        const top = topsCampeao.get(String(id))
        if (!top) {
          const linha = 'Sem local de vota├º├úo atribu├¡do a este bairro'
          return {
            type: 'Feature' as const,
            properties: {
              id,
              nome,
              votos: 0,
              total: 0,
              intensidade: 0,
              opacidade: 0,
              qualidade: q,
              rotulo: '',
              cor: '#475569',
              popupHtml: popupMarkup(nome, linha, notaQualidade || undefined),
              hoverHtml: hoverMarkup(nome, linha),
            },
            geometry: feature.geometry,
          }
        }
        const intensidade = maxTopPctCampeao > 0 ? Math.min(1, top.pct / maxTopPctCampeao) : 0
        const linha = `${top.candidato.nome_urna} ┬À ${top.candidato.partido}`
        const detalhe = `${nf.format(top.votos)} votos ┬À ${pctText(top.pct)} dos votos v├ílidos ┬À 1┬║ no bairro`
        return {
          type: 'Feature' as const,
          properties: {
            id,
            nome,
            votos: top.votos,
            total: top.total,
            intensidade,
            opacidade: 0.18 + 0.82 * intensidade,
            qualidade: q,
            rotulo: linha,
            cor: partyColor(top.candidato.partido, top.candidato.cor),
            popupHtml: popupMarkup(nome, `${linha} ÔÇö ${detalhe}`, notaQualidade || undefined),
            hoverHtml: hoverMarkup(nome, `${linha} ┬À ${pctText(top.pct)}`),
          },
          geometry: feature.geometry,
        }
      }

      if (!selecao || !agregados) return null
      const votos = selecao.votos[String(id)] ?? 0
      const total = agregados.total[String(id)] ?? 0
      const pct = total > 0 ? votos / total : 0
      const rank = ranks[String(id)] ?? 0
      const rankTxt = votos > 0 && rank > 0 ? `${rank}┬║` : ''
      let linha = ''
      if (total === 0) {
        linha = 'Sem local de vota├º├úo atribu├¡do a este bairro'
      } else if (selecao.tipo === 'total') {
        linha = `${nf.format(votos)} votos no bairro`
      } else if (votos === 0) {
        linha = `0 votos para ${selecao.rotulo} · ${pctText(pct)} dos votos válidos`
      } else {
        const posicao = selecao.tipo === 'partido' ? `${rankTxt} entre partidos` : `${rankTxt} no bairro`
        linha = `${nf.format(votos)} votos · ${pctText(pct)} dos votos válidos${rankTxt ? ` ┬À ${posicao}` : ''}`
      }
      let intensidade = 0
      if (votos > 0) {
        if (modo === 'rankeada') {
          if (maxPctSelecionado > 0) intensidade = pct / maxPctSelecionado
        } else if (modo === 'global') {
          if (selecao.tipo === 'total') {
            if (selecao.denomGlobal > 0) intensidade = votos / selecao.denomGlobal
          } else {
            const topPctBairro = topsCargoAtual.get(String(id))?.pct ?? 0
            if (topPctBairro > 0) intensidade = pct / topPctBairro
          }
        } else if (selecao.denomRel > 0) {
          intensidade = votos / selecao.denomRel
        }
      }
      intensidade = Math.max(0, Math.min(1, intensidade))

      return {
        type: 'Feature' as const,
        properties: {
          id,
          nome,
          votos,
          total,
          intensidade,
          opacidade: votos > 0 ? 0.12 + 0.8 * intensidade : 0,
          qualidade: q,
          rotulo: selecao.rotulo,
          cor: selecao.cor,
          popupHtml: popupMarkup(nome, linha, notaQualidade || undefined),
          hoverHtml: hoverMarkup(nome, linha),
        },
        geometry: feature.geometry,
      }
    })

    const source = map.getSource('bairros') as GeoJSONSource | undefined
    source?.setData({ type: 'FeatureCollection', features } as never)
    map.setPaintProperty(
      'bairros-fill',
      'fill-color',
      visao === 'campeoes' ? ['get', 'cor'] : (selecao?.cor ?? '#2563eb'),
    )

    if (!fittedRef.current) {
      const bounds = new LngLatBounds()
      for (const feature of geojson.features) extendBounds(bounds, feature.geometry)
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 24, duration: 0 })
      fittedRef.current = true
    }
  }, [
    pronto,
    geojson,
    votosDoc,
    selecao,
    modo,
    visao,
    campeaoCargo,
    agregados,
    ranks,
    maxPctSelecionado,
    topsCampeao,
    maxTopPctCampeao,
    topsCargoAtual,
  ])

  const lembrarSelecaoCargo = (id: string, nextPartidoId: string, nextCandidatoId: string) => {
    setSelecoesPorCargo((prev) => ({
      ...prev,
      [id]: { partidoId: nextPartidoId, candidatoId: nextCandidatoId },
    }))
  }

  const trocarCargo = (id: string) => {
    if (cargoId) {
      lembrarSelecaoCargo(cargoId, partidoId, candidatoId)
    }
    const salvo = selecoesPorCargo[id] ?? { partidoId: '', candidatoId: '' }
    setCargoId(id)
    setPartidoId(id === '11' ? '' : salvo.partidoId)
    setCandidatoId(salvo.candidatoId)
    if (id === '11' && modo === 'rankeada') setModo('relativo')
  }

  const trocarPartido = (sigla: string) => {
    setPartidoId(sigla)
    setCandidatoId('')
    if (cargoId) lembrarSelecaoCargo(cargoId, sigla, '')
    if (!sigla && modo === 'rankeada') setModo('relativo')
  }

  const focarBairro = (id: number, abrirPopup = true) => {
    const map = mapRef.current
    const feature = geojson?.features.find((item) => Number(item.properties.id) === id)
    if (!map || !feature) return
    setBairroSelecionado(id)
    setRankingOculto(false)
    setRankingAba('candidatos')
    const bounds = new LngLatBounds()
    extendBounds(bounds, feature.geometry)
    if (bounds.isEmpty()) return
    map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 700 })
    if (!abrirPopup) return
    const nome = feature.properties.nome ?? 'Bairro'
    if (visao === 'campeoes') {
      const top = topsCampeao.get(String(id))
      const linha = top
        ? `${top.candidato.nome_urna} ┬À ${top.candidato.partido} ÔÇö ${nf.format(top.votos)} votos ┬À ${pctText(top.pct)} ┬À 1┬║ no bairro`
        : 'Sem local de vota├º├úo atribu├¡do a este bairro'
      clickPopupRef.current?.remove()
      clickPopupRef.current = new Popup({ closeButton: true, maxWidth: '320px' })
        .setLngLat(bounds.getCenter())
        .setHTML(popupMarkup(nome, linha))
        .addTo(map)
    } else {
      clickPopupRef.current?.remove()
      clickPopupRef.current = null
    }
  }

  const selecionarBairroBusca = (id: number) => {
    setBuscaBairro('')
    setBuscaBairroAberta(false)
    focarBairro(id)
  }

  const escalaNota = !selecao
    ? 'Sem dados para a seleção'
    : modo === 'rankeada' && selecao.tipo !== 'total'
      ? `Foco no selecionado (%): compara bairros pelo percentual de votos de ${selecao.rotulo}; 100% = bairro onde foi mais forte (${pctText(maxPctSelecionado)}${bairroMaxPct ? `, ${bairroMaxPct}` : ''}).`
      : modo === 'global' && selecao.tipo !== 'total'
        ? `Comparação no cargo (% por bairro): em cada bairro, compara o percentual de ${selecao.rotulo} com o do candidato mais votado (percentual) naquele bairro; 100% = empatou/liderou no bairro.`
        : modo === 'global'
          ? `Comparação no cargo (votos): usa o bairro com mais votos no cargo como referência (${nf.format(selecao.denomGlobal)}).`
          : `Foco no selecionado (votos): usa o melhor bairro de ${selecao.rotulo}${bairroMaxVotos ? ` (${bairroMaxVotos})` : ''} como referência (${nf.format(selecao.denomRel)} votos).`

  const legendaInicio =
    modo === 'rankeada' || (modo === 'global' && selecao?.tipo !== 'total') ? '0% (menor)' : '0 votos (menor)'
  const legendaFim =
    modo === 'rankeada'
      ? `${pctText(maxPctSelecionado)} (máx. do selecionado)`
      : modo === 'global' && selecao?.tipo !== 'total'
        ? '100% (líder do bairro)'
        : `${nf.format(selecao?.denomRel ?? selecao?.denomGlobal ?? 0)} (máx.)`
  const candidatoPct =
    candidato && candidato.cargo_id === '11' && totalCargo > 0 ? candidato.votos_total / totalCargo : 1

  const selecionarCandidatoRanking = (item: Candidato) => {
    if (visao === 'campeoes') {
      setCargoId(campeaoCargo)
      setVisao('mapa')
    }
    setPartidoId(item.partido)
    setCandidatoId(item.id)
  }

  return (
    <div
      className={`map-shell${bairroSelecionado !== null ? ' com-ranking' : ''}${painelOculto ? ' panel-hidden' : ''} ${visao}`}
    >
      <div ref={containerRef} className="map" />

      <div className="bairro-search" ref={searchRef}>
        <input
          type="text"
          value={buscaBairro}
          placeholder="Buscar bairroÔÇª"
          onChange={(event) => {
            setBuscaBairro(event.target.value)
            setBuscaBairroAberta(true)
          }}
          onFocus={() => setBuscaBairroAberta(true)}
          aria-label="Buscar bairro"
        />
        {buscaBairroAberta && bairrosBusca.length > 0 && (
          <ul className="bairro-search-list">
            {bairrosBusca.map((item) => (
              <li key={item.id}>
                <button type="button" onMouseDown={() => selecionarBairroBusca(item.id)}>
                  {item.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className={`panel${painelOculto ? ' oculto' : ''}`}>
        <header className="panel-header">
          <div className="panel-title">
            <p className="eyebrow">Salvador ┬À Elei├º├Áes 2024</p>
            <h1>Mapa Eleitoral</h1>
            {!painelOculto && <p className="sub">1┬║ turno ┬À dados oficiais do TSE</p>}
          </div>
          <button
            type="button"
            className="panel-toggle"
            onClick={() => setPainelOculto((v) => !v)}
            title={painelOculto ? 'Mostrar painel' : 'Minimizar painel'}
            aria-label={painelOculto ? 'Mostrar painel' : 'Minimizar painel'}
            aria-expanded={!painelOculto}
          >
            {painelOculto ? 'Mostrar' : 'Minimizar'}
          </button>
        </header>

        {!painelOculto && (
          <>
            <div className="views">
              <button
                type="button"
                className={visao === 'mapa' ? 'ativo' : ''}
                onClick={() => setVisao('mapa')}
              >
                Mapa eleitoral
              </button>
              <button
                type="button"
                className={visao === 'campeoes' ? 'ativo' : ''}
                onClick={() => setVisao('campeoes')}
              >
                Campe├Áes
              </button>
            </div>

            {erro && <p className="erro">Erro: {erro}</p>}

            {visao === 'mapa' ? (
              <>
                <div className="controls">
                  <label className="cargo-field">
                    <span>Cargo</span>
                    <select value={cargoId} onChange={(event) => trocarCargo(event.target.value)}>
                      {candDoc?.cargos.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  {cargoId !== '11' && (
                    <SearchSelect
                      label="Partido"
                      value={partidoId}
                      options={partyOptions}
                      onChange={trocarPartido}
                      emptyLabel="--"
                      placeholder="Pesquisar por sigla, nome ou n├║meroÔÇª"
                    />
                  )}

                  <SearchSelect
                    label="Candidato"
                    value={candidatoId}
                    options={candidateOptions}
                    onChange={(value) => {
                      setCandidatoId(value)
                      if (!value) {
                        const nextPartido = cargoId === '11' ? '' : partidoId
                        if (cargoId === '11') setPartidoId('')
                        if (cargoId) lembrarSelecaoCargo(cargoId, nextPartido, '')
                        if (modo === 'rankeada') setModo('relativo')
                        return
                      }
                      const nextPartido = cargoId === '11' ? '' : partidoId
                      if (cargoId === '11') setPartidoId('')
                      if (cargoId) lembrarSelecaoCargo(cargoId, nextPartido, value)
                    }}
                    emptyLabel="Total do cargo"
                    placeholder="Pesquisar por nome, partido, n├║mero ou situa├º├úoÔÇª"
                  />
                </div>

                {resumo && (
                  <div className="candidato">
                    {candidato ? (
                      <Avatar
                        label={initials(candidato.nome_urna)}
                        fill={partyColor(candidato.partido, candidato.cor)}
                        ring={
                          candidato.cargo_id === '11'
                            ? partyColor(candidato.partido, candidato.cor)
                            : statusRingColor(candidato)
                        }
                        pct={candidatoPct}
                        foto={candidato.foto}
                        title={
                          candidato.cargo_id === '11'
                            ? `${pctText(candidatoPct)} dos votos para prefeito`
                            : ringTitle(candidato)
                        }
                      />
                    ) : partido ? (
                      <Avatar
                        label={partido.sigla}
                        fill={partido.cor}
                        ring={partido.cor}
                        pct={1}
                        title={`${partido.sigla} ÔÇö ${partido.nome}`}
                      />
                    ) : (
                      <span className="swatch" style={{ background: resumo.cor }} />
                    )}
                    <div className="candidato-info">
                      <strong>{resumo.titulo}</strong>
                      <span>{resumo.linha}</span>
                      {resumo.status && (
                        <span className={`status-chip status-${resumo.statusTone ?? 'nao'}`}>{resumo.status}</span>
                      )}
                      {resumo.statusDetalhe && <span className="status-detalhe">{resumo.statusDetalhe}</span>}
                      {resumo.nota && <span className="nota-resumo">{resumo.nota}</span>}
                    </div>
                  </div>
                )}

                <div className="modos">
                  <button
                    type="button"
                    className={modo === 'relativo' ? 'ativo' : ''}
                    onClick={() => setModo('relativo')}
                    title="Intensidade em votos absolutos: compara com o melhor bairro do selecionado (ou do total do cargo)."
                  >
                    Foco no selecionado (votos)
                  </button>
                  <button
                    type="button"
                    className={modo === 'rankeada' ? 'ativo' : ''}
                    onClick={() => setModo('rankeada')}
                    disabled={!selecao || selecao.tipo === 'total'}
                    title="Intensidade em %: compara bairros pelo percentual do candidato/partido selecionado; s├│ para candidato ou partido."
                  >
                    Foco no selecionado (%)
                  </button>
                  <button
                    type="button"
                    className={modo === 'global' ? 'ativo' : ''}
                    onClick={() => setModo('global')}
                    title="Para candidato/partido: compara o % do selecionado com o % do líder em cada bairro. Para total do cargo: compara votos por bairro."
                  >
                    Comparação no cargo
                  </button>
                </div>

                <div className="legenda">
                  <div className="gradiente" style={{ '--cor': selecao?.cor ?? '#2563eb' } as CSSProperties} />
                  <div className="legenda-texto">
                    <span>{legendaInicio}</span>
                    <span>{legendaFim}</span>
                  </div>
                  <div className="legenda-zero">
                    <span className="hatch" />
                    <span>{selecao?.tipo === 'total' ? 'sem local de vota├º├úo' : 'sem votos para a sele├º├úo'}</span>
                  </div>
                  <div className="legenda-nota">{escalaNota}</div>
                </div>
              </>
            ) : (
              <div className="campeoes-view">
                <div className="subtabs">
                  <button type="button" className={campeaoCargo === '11' ? 'ativo' : ''} onClick={() => setCampeaoCargo('11')}>
                    Prefeitos
                  </button>
                  <button type="button" className={campeaoCargo === '13' ? 'ativo' : ''} onClick={() => setCampeaoCargo('13')}>
                    Vereadores
                  </button>
                </div>

                <div className="subtabs secondary">
                  <button type="button" className={campeaoAba === 'candidatos' ? 'ativo' : ''} onClick={() => setCampeaoAba('candidatos')}>
                    Candidatos
                  </button>
                  <button type="button" className={campeaoAba === 'bairros' ? 'ativo' : ''} onClick={() => setCampeaoAba('bairros')}>
                    Bairros
                  </button>
                </div>

                <p className="view-intro">
                  Campe├Áes por bairro: candidato mais votado no cargo selecionado. A cor indica o partido e a opacidade o percentual.
                </p>

                <div className="legenda">
                  <div className="legenda-nota">Escala de opacidade: maior percentual entre os bairros ({pctText(maxTopPctCampeao)}).</div>
                  <div className="legenda-zero">
                    <span className="hatch" />
                    <span>sem local de vota├º├úo</span>
                  </div>
                  <div className="top-partidos">
                    {topPartidosCampeao.map((item) => (
                      <span key={item.sigla}>
                        <i style={{ background: item.cor }} />
                        {item.sigla} <b>{item.bairros}</b>
                      </span>
                    ))}
                  </div>
                </div>

                <label className="filtro-field">
                  <span>Filtrar</span>
                  <input
                    className="filtro"
                    value={filtroCampeoes}
                    onChange={(event) => setFiltroCampeoes(event.target.value)}
                    placeholder={campeaoAba === 'candidatos' ? 'Candidato, partido ou bairroÔÇª' : 'Bairro ou campe├úoÔÇª'}
                  />
                </label>

                {campeaoAba === 'candidatos' ? (
                  <ul className="lista-campeoes candidatos">
                    {campeoesCandidatosFiltrados.map((item) => (
                      <li key={item.candidato.id}>
                        <div className="campeao-candidato">
                          <Avatar
                            label={initials(item.candidato.nome_urna)}
                            fill={partyColor(item.candidato.partido, item.candidato.cor)}
                            ring={partyColor(item.candidato.partido, item.candidato.cor)}
                            pct={1}
                            foto={item.candidato.foto}
                            title={item.candidato.status_label}
                            size={40}
                          />
                          <div className="lista-texto">
                            <strong>
                              {item.candidato.nome_urna} ┬À {item.candidato.partido}
                            </strong>
                            <span>
                              Campe├úo em {item.bairros} bairro{item.bairros === 1 ? '' : 's'}
                              {item.bairrosNomes.length
                                ? `: ${item.bairrosNomes.join(', ')}${item.bairros > item.bairrosNomes.length ? 'ÔÇª' : ''}`
                                : ''}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="lista-campeoes bairros">
                    {campeoesBairrosFiltrados.map((item) => {
                      const top = item.top
                      return (
                        <li key={item.id}>
                          <button type="button" onClick={() => focarBairro(item.id)}>
                            {top ? (
                              <Avatar
                                label={initials(top.candidato.nome_urna)}
                                fill={partyColor(top.candidato.partido, top.candidato.cor)}
                                ring={partyColor(top.candidato.partido, top.candidato.cor)}
                                pct={1}
                                foto={top.candidato.foto}
                                title={top.candidato.status_label}
                                size={36}
                              />
                            ) : (
                              <span className="lista-cor vazio" />
                            )}
                            <span className="lista-texto">
                              <strong>{item.nome}</strong>
                              <span>
                                {top ? `${top.candidato.nome_urna} ┬À ${top.candidato.partido}` : 'Sem local de vota├º├úo'}
                              </span>
                            </span>
                            {top && <span className="lista-pct">{pctText(top.pct)}</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <p className="nota-lista">
                  {campeaoAba === 'candidatos'
                    ? `${campeoesCandidatosFiltrados.length} campe├Áes`
                    : `${campeoesBairrosFiltrados.length} de ${campeoesBairros.length} bairros`}
                </p>
              </div>
            )}

            {meta && (
              <details className="sobre">
                <summary>Sobre os dados e cobertura</summary>
                <p>
                  Votos por <strong>local de vota├º├úo</strong> (se├º├úo eleitoral), n├úo por resid├¬ncia do eleitor.
                  A distribui├º├úo por bairro ├® uma <strong>aproxima├º├úo</strong> (local ÔåÆ bairro).
                </p>
                {meta && (
                  <>
                    <p>
                      <strong>Cobertura:</strong> {Math.round(meta.cobertura_votos * 100)}% dos votos de candidatos atribu├¡dos a bairro
                      ({nf.format(meta.votos_atribuidos_bairro ?? 0)} de {nf.format(meta.votos_candidatos ?? 0)}).{' '}
                      {nf.format(meta.secoes_mapeadas ?? 0)}/{nf.format(meta.secoes_total ?? 0)} se├º├Áes mapeadas em {nf.format(meta.locais_distintos ?? 0)} locais.
                    </p>
                    <p>
                      <strong>M├®todo de atribui├º├úo:</strong> {nf.format(meta.secoes_por_coordenada ?? 0)} se├º├Áes por coordenada do local,{' '}
                      {nf.format(meta.secoes_por_alias ?? 0)} por alias de nome, {nf.format(meta.secoes_por_nome_prioritario ?? 0)} por nome priorit├írio,{' '}
                      {nf.format(meta.secoes_por_nome ?? 0)} por nome exato, {nf.format(meta.secoes_sem_bairro ?? 0)} sem bairro.
                    </p>
                    <p>
                      <strong>Base:</strong> {nf.format(meta.bairros ?? 0)} bairros oficiais (ArcGIS vigente) e {nf.format(meta.candidatos ?? 0)} candidatos.
                      Percentuais usam votos v├ílidos do cargo no bairro (candidatos + legenda no vereador).
                    </p>
                    <p>
                      <strong>Bairros sem votos/local atribu├¡do ({bairrosSemVoto.length}):</strong>{' '}
                      {bairrosSemVoto.length ? bairrosSemVoto.join(', ') : 'nenhum'}.
                    </p>
                    {meta.coeficiente_eleitoral ? (
                      <p>
                        <strong>Vereador (proporcional):</strong> {nf.format(meta.cadeiras_vereador ?? 0)} cadeiras, QE {nf.format(meta.coeficiente_eleitoral)},
                        piso 10% do QE ({nf.format(meta.limite_10_coeficiente ?? 0)}). Cadeiras pertencem ├á agremia├º├úo (partido/federa├º├úo), n├úo diretamente ao partido em federa├º├Áes.
                      </p>
                    ) : null}
                  </>
                )}
                <p>
                  <strong>Modos de cor (intensidade):</strong> “Foco no selecionado (votos)” compara por votos absolutos com o melhor bairro da seleção;
                  “Foco no selecionado (%)” compara pelo percentual do selecionado em cada bairro; “Comparação no cargo” compara, em cada bairro, o percentual do selecionado com o do líder do cargo naquele bairro (no total do cargo, compara votos por bairro).
                </p>
                <p>
                  Avatares exibem foto oficial do TSE quando dispon├¡vel (com iniciais como alternativa). Clique em um bairro para ver o ranking (candidatos e agremia├º├Áes).
                </p>
                <p className="fonte">
                  Fonte: TSE Dados Abertos (Salvador/BA, 2024, 1┬║ turno) e base territorial oficial (Decreto n┬║ 32.791/2020). Gerado em {meta?.gerado_em ?? 'ÔÇö'}.
                </p>
              </details>
            )}
          </>
        )}
      </section>

      {bairroSelecionado !== null && rankingBairro && rankingCargo && (
        <aside
          className={`ranking-panel${rankingOculto ? ' oculto' : ''}`}
          aria-label={`Ranking em ${rankingBairro.bairro.nome}`}
        >
          <header className="ranking-head">
            <div>
              <span className="ranking-kicker">Ranking no bairro</span>
              <h2>{rankingBairro.bairro.nome}</h2>
              {!rankingOculto && (
                <span className="ranking-sub">
                  {rankingCargo.nome} ┬À {nf.format(rankingBairro.total)} votos v├ílidos
                </span>
              )}
            </div>
            <div className="ranking-actions">
              <button
                type="button"
                className="ranking-minimize"
                onClick={() => setRankingOculto((v) => !v)}
                title={rankingOculto ? 'Mostrar ranking' : 'Minimizar ranking'}
                aria-label={rankingOculto ? 'Mostrar ranking' : 'Minimizar ranking'}
                aria-expanded={!rankingOculto}
              >
                {rankingOculto ? 'Mostrar' : 'Minimizar'}
              </button>
              <button
                type="button"
                className="ranking-close"
                onClick={() => setBairroSelecionado(null)}
                title="Fechar ranking"
                aria-label="Fechar ranking"
              >
                ├ù
              </button>
            </div>
          </header>

          {!rankingOculto && (
            <>
              <div className="ranking-tabs">
                <button
                  type="button"
                  className={rankingAba === 'candidatos' ? 'ativo' : ''}
                  onClick={() => setRankingAba('candidatos')}
                >
                  Candidatos
                </button>
                <button
                  type="button"
                  className={rankingAba === 'partidos' ? 'ativo' : ''}
                  onClick={() => setRankingAba('partidos')}
                >
                  {rankingCargo.id === '13' ? 'Agremia├º├Áes' : 'Partidos'}
                </button>
              </div>

              {rankingBairro.total === 0 ? (
                <p className="ranking-empty">Sem local de vota├º├úo atribu├¡do a este bairro.</p>
              ) : rankingAba === 'candidatos' ? (
                rankingBairro.candidatos.length === 0 ? (
                  <p className="ranking-empty">Nenhum candidato recebeu votos neste bairro.</p>
                ) : (
                  <>
                    <ol className="ranking-list">
                      {rankingBairro.candidatos.map((item) => (
                        <li key={item.candidato.id}>
                          <button
                            type="button"
                            className={item.candidato.id === candidatoId ? 'selecionado' : ''}
                            onClick={() => selecionarCandidatoRanking(item.candidato)}
                            title={item.candidato.status_label}
                          >
                            <span className="ranking-pos">{item.rank}</span>
                            <span
                              className="ranking-cor"
                              style={{ background: partyColor(item.candidato.partido, item.candidato.cor) }}
                            />
                            <span className="ranking-nome">
                              <strong>{item.candidato.nome_urna}</strong>
                              <span>{item.candidato.partido}</span>
                            </span>
                            <span className="ranking-votos">
                              <b>{nf.format(item.votos)}</b>
                              <span>{pctText(item.pct)}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <p className="ranking-count">
                      {nf.format(rankingBairro.candidatos.length)} candidato
                      {rankingBairro.candidatos.length === 1 ? '' : 's'} com voto ┬À clique para ver no mapa
                    </p>
                  </>
                )
              ) : rankingBairro.partidos.length === 0 ? (
                <p className="ranking-empty">
                  Nenhum{rankingCargo.id === '13' ? 'a agremia├º├úo recebeu' : ' partido recebeu'} votos neste bairro.
                </p>
              ) : (
                <>
                  <ol className="ranking-list partidos">
                    {rankingBairro.partidos.map((item) => (
                      <li key={item.sigla}>
                        <div className="ranking-row">
                          <span className="ranking-pos">{item.rank}</span>
                          <span className="ranking-cor" style={{ background: item.cor }} />
                          <span className="ranking-nome">
                            <strong>{item.sigla}</strong>
                            <span>
                              {rankingCargo.id === '13' && item.tipo === 'FEDERA├ç├âO'
                                ? `${item.nome} ┬À federa├º├úo`
                                : rankingCargo.id === '13'
                                  ? 'partido'
                                  : item.nome}
                              {' ┬À '}
                              {item.candidatos} candidato{item.candidatos === 1 ? '' : 's'}
                              {item.legenda > 0 ? ` ┬À legenda ${nf.format(item.legenda)}` : ''}
                            </span>
                          </span>
                          <span className="ranking-votos">
                            <b>{nf.format(item.votos)}</b>
                            <span>{pctText(item.pct)}</span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <p className="ranking-count">
                    {nf.format(rankingBairro.partidos.length)}{' '}
                    {rankingCargo.id === '13' ? 'agremia├º├úo' : 'partido'}
                    {rankingBairro.partidos.length === 1 ? '' : rankingCargo.id === '13' ? '├Áes' : 's'}
                    {rankingCargo.id === '13'
                      ? ' ┬À votos nominais por federa├º├úo/partido; cadeiras proporcionais v├úo para a agremia├º├úo'
                      : ''}
                  </p>
                </>
              )}
            </>
          )}
        </aside>
      )}
    </div>
  )
}

export default App
