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
  agremiacao_tipo: 'PARTIDO' | 'FEDERAÇÃO'
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
}

type Cargo = { id: string; nome: string; candidatos: Candidato[] }

type Meta = {
  municipio: string
  ano: number
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

type Modo = 'global' | 'relativo'
type Visao = 'mapa' | 'vereador'
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

type TopVereador = {
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
    return 'Sem resultado eleitoral (indeferido, cassado ou renúncia)'
  }
  return candidato.status_label
}

function statusBadge(candidato: Candidato): { badge: string; tone: StatusTone } {
  switch (candidato.status) {
    case 'eleito_proprios':
      return { badge: 'Próprios', tone: 'eleito' }
    case 'eleito_coeficiente':
      return { badge: 'Coef.', tone: 'coeficiente' }
    case 'eleito':
      return { badge: 'Eleito', tone: 'eleito' }
    case 'nao_eleito_10':
      return { badge: '<10%', tone: 'alerta' }
    case 'nao_eleito_partido':
      return { badge: 'Partido', tone: 'alerta' }
    case 'nao_eleito':
      return { badge: candidato.suplente ? 'Suplente' : 'Não eleito', tone: 'nao' }
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
  if (!ctx) throw new Error('Canvas 2D indisponível')
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
}: {
  label: string
  fill: string
  ring: string
  pct: number
  title: string
}) {
  const clamped = Math.max(0, Math.min(1, pct))
  return (
    <span
      className="avatar"
      style={
        {
          '--ring': ring,
          '--fill': fill,
          '--pct': `${Math.round(clamped * 100)}%`,
        } as CSSProperties
      }
      title={title}
    >
      <span className="avatar-inner">{label}</span>
    </span>
  )
}

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const fittedRef = useRef(false)
  const hoverPopupRef = useRef<Popup | null>(null)
  const clickPopupRef = useRef<Popup | null>(null)

  const [geojson, setGeojson] = useState<BairroCollection | null>(null)
  const [candDoc, setCandDoc] = useState<CandidatosDoc | null>(null)
  const [votosDoc, setVotosDoc] = useState<VotosDoc | null>(null)
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  const [cargoId, setCargoId] = useState('')
  const [partidoId, setPartidoId] = useState('')
  const [candidatoId, setCandidatoId] = useState('')
  const [modo, setModo] = useState<Modo>('relativo')
  const [visao, setVisao] = useState<Visao>('mapa')
  const [filtroVereador, setFiltroVereador] = useState('')

  const cargo = useMemo(
    () => candDoc?.cargos.find((item) => item.id === cargoId) ?? null,
    [candDoc, cargoId],
  )
  const candidato = useMemo(
    () => cargo?.candidatos.find((item) => item.id === candidatoId) ?? null,
    [cargo, candidatoId],
  )
  const meta = votosDoc?.meta ?? candDoc?.meta ?? null
  const incluirLegenda = cargo?.id === '13'

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
    const lista = partidoId
      ? cargo.candidatos.filter((item) => item.partido === partidoId)
      : cargo.candidatos
    return [...lista].sort(
      (a, b) => b.votos_total - a.votos_total || a.nome_urna.localeCompare(b.nome_urna, 'pt-BR'),
    )
  }, [cargo, partidoId])

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
    const legendaTotal = Object.values(votosDoc?.legenda_total ?? {}).reduce(
      (soma, valor) => soma + valor,
      0,
    )
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

  const topVereadores = useMemo(() => {
    const doc = candDoc?.cargos.find((item) => item.id === '13')
    const melhor = new Map<string, TopVereador>()
    if (!doc || !votosDoc) return melhor

    const totais: Record<string, number> = {}
    for (const item of doc.candidatos) {
      for (const [bairroId, qtd] of Object.entries(votosDoc.por_candidato[item.id] ?? {})) {
        totais[bairroId] = (totais[bairroId] ?? 0) + qtd
      }
    }
    for (const votosLegenda of Object.values(votosDoc.legenda ?? {})) {
      for (const [bairroId, qtd] of Object.entries(votosLegenda)) {
        totais[bairroId] = (totais[bairroId] ?? 0) + qtd
      }
    }

    for (const item of doc.candidatos) {
      for (const [bairroId, qtd] of Object.entries(votosDoc.por_candidato[item.id] ?? {})) {
        const atual = melhor.get(bairroId)
        if (
          !atual ||
          qtd > atual.votos ||
          (qtd === atual.votos &&
            item.nome_urna.localeCompare(atual.candidato.nome_urna, 'pt-BR') < 0)
        ) {
          const total = totais[bairroId] ?? 0
          melhor.set(bairroId, {
            candidato: item,
            votos: qtd,
            total,
            pct: total > 0 ? qtd / total : 0,
          })
        }
      }
    }
    return melhor
  }, [candDoc, votosDoc])

  const maxTopPct = useMemo(
    () =>
      [...topVereadores.values()].reduce((maior, item) => Math.max(maior, item.pct), 0),
    [topVereadores],
  )

  const topBairros = useMemo(() => {
    if (!votosDoc) return []
    return votosDoc.bairros
      .map((item) => ({ ...item, top: topVereadores.get(String(item.id)) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [votosDoc, topVereadores])

  const topBairrosFiltrados = useMemo(() => {
    const termo = normalizar(filtroVereador.trim())
    if (!termo) return topBairros
    return topBairros.filter((item) => {
      const alvo = item.top
        ? `${item.nome} ${item.top.candidato.nome_urna} ${item.top.candidato.nome} ${item.top.candidato.partido}`
        : item.nome
      return normalizar(alvo).includes(termo)
    })
  }, [topBairros, filtroVereador])

  const topPartidos = useMemo(() => {
    const mapa = new Map<string, { sigla: string; cor: string; bairros: number }>()
    for (const item of topVereadores.values()) {
      const cor = partyColor(item.candidato.partido, item.candidato.cor)
      const atual = mapa.get(item.candidato.partido) ?? {
        sigla: item.candidato.partido,
        cor,
        bairros: 0,
      }
      atual.bairros += 1
      mapa.set(item.candidato.partido, atual)
    }
    return [...mapa.values()].sort(
      (a, b) => b.bairros - a.bairros || a.sigla.localeCompare(b.sigla, 'pt-BR'),
    )
  }, [topVereadores])

  const resumo = useMemo<Resumo | null>(() => {
    if (!selecao) return null
    if (selecao.tipo === 'candidato' && candidato) {
      const nota =
        candidato.agremiacao_tipo === 'FEDERAÇÃO'
          ? candidato.cargo_id === '13'
            ? `Federação: ${candidato.agremiacao_nome} · ${nf.format(candidato.agremiacao_votos ?? 0)} votos · ${candidato.agremiacao_qp ?? 0} QP`
            : `Federação: ${candidato.agremiacao_nome}`
          : candidato.partido_nome
      return {
        cor: selecao.cor,
        titulo: candidato.nome_urna,
        linha: `${candidato.partido} · ${candidato.cargo} · ${nf.format(candidato.votos_total)} votos`,
        nota,
        status: candidato.status_label,
        statusTone: statusTone(candidato.status),
        statusDetalhe: candidato.status_detalhe,
      }
    }
    if (selecao.tipo === 'partido' && partido) {
      return {
        cor: selecao.cor,
        titulo: `${partido.sigla} — ${partido.nome}`,
        linha: `${nf.format(partido.candidatos)} candidato${partido.candidatos > 1 ? 's' : ''} · ${nf.format(partido.votos_total)} votos · ${nf.format(partido.eleitos)} eleito${partido.eleitos === 1 ? '' : 's'}`,
        nota: incluirLegenda
          ? 'Soma dos candidatos do partido + votos de legenda'
          : 'Partido com um único candidato ao cargo',
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
        label: `${item.sigla} — ${item.nome} (${item.numero}) · ${nf.format(item.votos_total)}`,
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
          label: `${item.nome_urna} · ${item.partido} (${item.numero}) · ${nf.format(item.votos_total)}`,
          search: `${item.nome} ${item.nome_urna} ${item.partido} ${item.partido_nome} ${item.numero} ${item.status_label} ${item.suplente ? 'suplente' : ''} ${item.eleito ? 'eleito' : 'não eleito'}`,
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
      if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`)
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
        setCargoId(firstCargo.id)
        setPartidoId('')
        setCandidatoId(firstCargo.candidatos[0]?.id ?? '')
      })
      .catch((error) => {
        if (alive) setErro((error as Error).message)
      })
    return () => {
      alive = false
    }
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
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

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
        },
      })
      map.addLayer({
        id: 'bairros-zero',
        type: 'fill',
        source: 'bairros',
        filter: ['==', ['get', 'votos'], 0],
        paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.55 },
      })
      map.addLayer({
        id: 'bairros-line',
        type: 'line',
        source: 'bairros',
        paint: { 'line-color': '#1e293b', 'line-width': 0.7, 'line-opacity': 0.7 },
      })

      map.on('click', (event: MapLayerMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, {
          layers: ['bairros-fill', 'bairros-zero'],
        })[0]
        if (!feature) return
        const props = (feature.properties ?? {}) as Record<string, unknown>
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
  }, [visao, cargoId, partidoId, candidatoId, modo])

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
          ? `${Math.round(q * 100)}% das seções deste bairro localizadas por coordenada; o restante por nome/aliase do TSE`
          : ''

      if (visao === 'vereador') {
        const top = topVereadores.get(String(id))
        if (!top) {
          const linha = 'Sem local de votação atribuído a este bairro'
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
        const intensidade = maxTopPct > 0 ? Math.min(1, top.pct / maxTopPct) : 0
        const linha = `${top.candidato.nome_urna} · ${top.candidato.partido}`
        const detalhe = `${nf.format(top.votos)} votos · ${pctText(top.pct)} dos votos válidos · 1º entre vereadores`
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
            popupHtml: popupMarkup(nome, `${linha} — ${detalhe}`, notaQualidade || undefined),
            hoverHtml: hoverMarkup(nome, `${linha} · ${pctText(top.pct)}`),
          },
          geometry: feature.geometry,
        }
      }

      if (!selecao || !agregados) return null
      const votos = selecao.votos[String(id)] ?? 0
      const total = agregados.total[String(id)] ?? 0
      const pct = total > 0 ? votos / total : 0
      const rank = ranks[String(id)]
      const rankTxt = votos > 0 && rank ? `${rank}º` : ''
      let linha = ''
      if (total === 0) {
        linha = 'Sem local de votação atribuído a este bairro'
      } else if (selecao.tipo === 'total') {
        linha = `${nf.format(votos)} votos no bairro`
      } else if (votos === 0) {
        linha = `0 votos para ${selecao.rotulo} · ${pctText(pct)} dos votos válidos`
      } else {
        const posicao =
          selecao.tipo === 'partido' ? `${rankTxt} entre partidos` : `${rankTxt} no bairro`
        linha = `${nf.format(votos)} votos · ${pctText(pct)} dos votos válidos${rankTxt ? ` · ${posicao}` : ''}`
      }
      const escala =
        modo === 'global'
          ? selecao.tipo === 'total'
            ? selecao.denomGlobal
            : selecao.pctGlobalMax
          : selecao.denomRel
      const intensidade =
        votos > 0 && escala > 0
          ? Math.min(
              1,
              modo === 'global' && selecao.tipo !== 'total' ? pct / escala : votos / escala,
            )
          : 0

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
      visao === 'vereador' ? ['get', 'cor'] : (selecao?.cor ?? '#2563eb'),
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
    agregados,
    ranks,
    topVereadores,
    maxTopPct,
  ])

  const trocarCargo = (id: string) => {
    setCargoId(id)
    setPartidoId('')
    const alvo = candDoc?.cargos.find((item) => item.id === id)
    setCandidatoId(alvo?.candidatos[0]?.id ?? '')
  }

  const trocarPartido = (sigla: string) => {
    setPartidoId(sigla)
    setCandidatoId('')
  }

  const focarBairro = (id: number) => {
    const map = mapRef.current
    const feature = geojson?.features.find((item) => Number(item.properties.id) === id)
    if (!map || !feature) return
    const bounds = new LngLatBounds()
    extendBounds(bounds, feature.geometry)
    if (bounds.isEmpty()) return
    map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 600 })
    const top = topVereadores.get(String(id))
    const nome = feature.properties.nome ?? 'Bairro'
    const linha = top
      ? `${top.candidato.nome_urna} · ${top.candidato.partido} — ${nf.format(top.votos)} votos · ${pctText(top.pct)} dos votos válidos · 1º entre vereadores`
      : 'Sem local de votação atribuído a este bairro'
    clickPopupRef.current?.remove()
    clickPopupRef.current = new Popup({ closeButton: true, maxWidth: '320px' })
      .setLngLat(bounds.getCenter())
      .setHTML(popupMarkup(nome, linha, top ? 'Vereador mais votado no bairro' : undefined))
      .addTo(map)
  }

  const escalaNota = !selecao
    ? 'Sem dados para a seleção'
    : modo === 'global' && selecao.tipo !== 'total'
      ? `Escala global: maior percentual de ${selecao.tipo === 'candidato' ? 'um candidato' : 'um partido'} neste cargo em um bairro (${pctText(selecao.pctGlobalMax)})`
      : modo === 'global'
        ? `Escala global: bairro mais forte com ${nf.format(selecao.denomGlobal)} votos`
        : `Escala do selecionado: bairro mais forte com ${nf.format(selecao.denomRel)} votos`

  const candidatoPct =
    candidato && candidato.cargo_id === '11' && totalCargo > 0
      ? candidato.votos_total / totalCargo
      : 1

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map" />

      <section className="panel">
        <header>
          <h1>Mapa Eleitoral de Salvador</h1>
          <p className="sub">Eleições 2024 · 1º turno · dados oficiais do TSE</p>
        </header>

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
            className={visao === 'vereador' ? 'ativo' : ''}
            onClick={() => setVisao('vereador')}
          >
            Vereador por bairro
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

              <SearchSelect
                label="Partido"
                value={partidoId}
                options={partyOptions}
                onChange={trocarPartido}
                emptyLabel="--"
                placeholder="Pesquisar por sigla, nome ou número…"
              />

              <SearchSelect
                label="Candidato"
                value={candidatoId}
                options={candidateOptions}
                onChange={(value) => {
                  setCandidatoId(value)
                  if (!value) setPartidoId('')
                }}
                emptyLabel="Total do cargo"
                placeholder="Pesquisar por nome, partido, número ou situação…"
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
                    title={`${partido.sigla} — ${partido.nome}`}
                  />
                ) : (
                  <span className="swatch" style={{ background: resumo.cor }} />
                )}
                <div className="candidato-info">
                  <strong>{resumo.titulo}</strong>
                  <span>{resumo.linha}</span>
                  {resumo.status && (
                    <span className={`status-chip status-${resumo.statusTone ?? 'nao'}`}>
                      {resumo.status}
                    </span>
                  )}
                  {resumo.statusDetalhe && (
                    <span className="status-detalhe">{resumo.statusDetalhe}</span>
                  )}
                  {resumo.nota && <span className="nota-resumo">{resumo.nota}</span>}
                </div>
              </div>
            )}

            <div className="modos">
              <button
                type="button"
                className={modo === 'relativo' ? 'ativo' : ''}
                onClick={() => setModo('relativo')}
              >
                Relativa ao selecionado
              </button>
              <button
                type="button"
                className={modo === 'global' ? 'ativo' : ''}
                onClick={() => setModo('global')}
              >
                Global
              </button>
            </div>

            <div className="legenda">
              <div
                className="gradiente"
                style={{ '--cor': selecao?.cor ?? '#2563eb' } as CSSProperties}
              />
              <div className="legenda-texto">
                <span>
                  {modo === 'global' && selecao?.tipo !== 'total' ? '0%' : 'menos votos'}
                </span>
                <span>
                  {modo === 'global' && selecao?.tipo !== 'total'
                    ? pctText(selecao?.pctGlobalMax ?? 0)
                    : 'mais votos'}
                </span>
              </div>
              <div className="legenda-zero">
                <span className="hatch" />
                <span>
                  {selecao?.tipo === 'total' ? 'sem local de votação' : 'sem votos para a seleção'}
                </span>
              </div>
              <div className="legenda-nota">
                {escalaNota} · clique ou passe o mouse no bairro
              </div>
            </div>
          </>
        ) : (
          <div className="vereador-view">
            <p className="view-intro">
              Cada bairro é colorido pelo partido do vereador mais votado. A opacidade indica o
              percentual de votos válidos que ele alcançou no bairro.
            </p>
            <div className="legenda">
              <div className="legenda-nota">
                Escala de opacidade: maior percentual entre os bairros ({pctText(maxTopPct)}).
              </div>
              <div className="legenda-zero">
                <span className="hatch" />
                <span>sem local de votação</span>
              </div>
              <div className="top-partidos">
                {topPartidos.map((item) => (
                  <span key={item.sigla}>
                    <i style={{ background: item.cor }} />
                    {item.sigla} <b>{item.bairros}</b>
                  </span>
                ))}
              </div>
            </div>
            <label className="filtro-field">
              <span>Filtrar bairro ou vereador</span>
              <input
                className="filtro"
                value={filtroVereador}
                onChange={(event) => setFiltroVereador(event.target.value)}
                placeholder="Ex.: Pituba, Jorge Araújo, PT…"
              />
            </label>
            <ul className="lista-vereadores">
              {topBairrosFiltrados.map((item) => {
                const top = item.top
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => focarBairro(item.id)}>
                      <span
                        className="lista-cor"
                        style={{
                          background: top
                            ? partyColor(top.candidato.partido, top.candidato.cor)
                            : '#cbd5e1',
                        }}
                      />
                      <span className="lista-texto">
                        <strong>{item.nome}</strong>
                        <span>
                          {top
                            ? `${top.candidato.nome_urna} · ${top.candidato.partido}`
                            : 'Sem local de votação'}
                        </span>
                      </span>
                      {top && <span className="lista-pct">{pctText(top.pct)}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="nota-lista">
              {topBairrosFiltrados.length} de {topBairros.length} bairros
            </p>
          </div>
        )}

        {meta && (
          <details className="sobre">
            <summary>Dados e limitações</summary>
            <p>
              Votos por <strong>local de votação</strong> (seção), não por residência do eleitor.
              Bairros sem local de votação atribuído aparecem sem cor no total.
            </p>
            <p>
              {nf.format(meta.secoes_total)} seções: {nf.format(meta.secoes_por_coordenada)} por
              coordenada; {nf.format(meta.secoes_por_alias ?? 0)} por aliase do nome TSE→bairro
              oficial; {nf.format(meta.secoes_por_nome_prioritario ?? 0)} por nome prioritário (casos
              de geocodificação ruim); {nf.format(meta.secoes_por_nome)} por nome exato;{' '}
              {nf.format(meta.secoes_sem_bairro)} sem bairro. {nf.format(meta.locais_distintos)}{' '}
              locais de votação distintos.
            </p>
            <p>
              {Math.round(meta.cobertura_votos * 100)}% dos votos de candidatos atribuídos a um
              bairro. {nf.format(meta.bairros)} bairros oficiais e {nf.format(meta.candidatos)}{' '}
              candidatos. Percentuais no mapa usam os votos válidos do cargo no bairro (candidatos +
              legenda, no caso de vereador).
            </p>
            <p>
              Avatares usam iniciais (as fotos oficiais não são carregadas). No prefeito, o anel
              mostra o percentual de votos válidos; no vereador, o anel é cheio e a cor indica a
              situação: verde para eleito, âmbar para coeficiente, vermelho para abaixo do piso ou
              sem resultado, e cinza para não eleito.
            </p>
            {meta.votos_legenda ? (
              <p>
                {nf.format(meta.votos_legenda)} votos de legenda (vereador) são somados ao partido;
                destes, {nf.format(meta.votos_legenda_bairro ?? 0)} foram atribuídos a bairros.
              </p>
            ) : null}
            {meta.coeficiente_eleitoral ? (
              <>
                <p>
                  <strong>Vereador (proporcional):</strong> {nf.format(meta.cadeiras_vereador ?? 0)}{' '}
                  cadeiras, QE de {nf.format(meta.coeficiente_eleitoral)} votos e piso individual de
                  10% do QE ({nf.format(meta.limite_10_coeficiente ?? 0)} votos). Federações disputam
                  o coeficiente em conjunto.
                </p>
                <p>
                  <strong>Como ler a situação:</strong> “Eleito com votos próprios” alcançou o QE
                  sozinho; “Eleito com votos do coeficiente eleitoral” entrou pela votação do
                  partido ou federação; “Não eleito — abaixo de 10% do coeficiente eleitoral” não
                  atingiu o piso individual; “Não eleito — o partido não atingiu o coeficiente
                  eleitoral” ficou abaixo do QE mesmo tendo alcançado o piso individual.
                </p>
              </>
            ) : null}
            <p className="fonte">
              Fonte: TSE Dados Abertos (Eleições 2024, Salvador/BA, 1º turno) — votação por seção e
              locais de votação. Base territorial: bairros oficiais de Salvador (Decreto nº
              32.791/2020). `NM_BAIRRO` do TSE identifica o bairro do local de votação e pode
              divergir do oficial; nomes divergentes foram mapeados por aliases. Coordenadas `-1,-1`
              não são geocodificadas.
            </p>
          </details>
        )}
      </section>
    </div>
  )
}

export default App
