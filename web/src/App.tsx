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

type PartidoResumo = {
  sigla: string
  nome: string
  numero: string
  cor: string
  votos_total: number
  candidatos: number
  eleitos: number
}

type Selecao = {
  tipo: 'candidato' | 'partido' | 'total'
  cor: string
  rotulo: string
  votos: Record<string, number>
  denomRel: number
  denomGlobal: number
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

type StatusTone = 'eleito' | 'coeficiente' | 'nao' | 'alerta'

function statusTone(status: string): StatusTone {
  if (status === 'eleito' || status === 'eleito_proprios') return 'eleito'
  if (status === 'eleito_coeficiente') return 'coeficiente'
  if (status === 'nao_eleito_10' || status === 'nao_eleito_partido') return 'alerta'
  return 'nao'
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

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const fittedRef = useRef(false)

  const [geojson, setGeojson] = useState<BairroCollection | null>(null)
  const [candDoc, setCandDoc] = useState<CandidatosDoc | null>(null)
  const [votosDoc, setVotosDoc] = useState<VotosDoc | null>(null)
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  const [cargoId, setCargoId] = useState('')
  const [partidoId, setPartidoId] = useState('')
  const [candidatoId, setCandidatoId] = useState('')
  const [modo, setModo] = useState<Modo>('relativo')

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
      for (const [sigla, votosLegenda] of Object.entries(votosDoc?.legenda ?? {})) {
        const atual = porPartido.get(sigla)
        if (!atual) continue
        for (const [bairroId, qtd] of Object.entries(votosLegenda)) {
          atual.votos[bairroId] = (atual.votos[bairroId] ?? 0) + qtd
          total[bairroId] = (total[bairroId] ?? 0) + qtd
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
      }
    }
    return null
  }, [candidato, partido, agregados, cargo, votosDoc])

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

  const denominador = selecao
    ? modo === 'global'
      ? selecao.denomGlobal
      : selecao.denomRel
    : 0

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
        const props = feature.properties as Record<string, unknown>
        const nome = String(props.nome ?? 'Bairro')
        const votos = Number(props.votos ?? 0)
        const total = Number(props.total ?? 0)
        const rotulo = String(props.rotulo ?? '')
        const qualidade = props.qualidade
        const detalhe =
          total === 0
            ? 'Sem local de votação atribuído a este bairro'
            : votos === 0
              ? `0 votos para ${escapeHtml(rotulo || 'a seleção')} · ${nf.format(total)} votos no bairro`
              : `${nf.format(votos)} votos${rotulo ? ` · ${escapeHtml(rotulo)}` : ''}`
        const nota =
          typeof qualidade === 'number' && qualidade < 0.999
            ? `<div class="pop-note">${Math.round(qualidade * 100)}% das seções deste bairro localizadas por coordenada; o restante por nome/aliase do TSE</div>`
            : ''
        new Popup({ closeButton: true })
          .setLngLat(event.lngLat)
          .setHTML(
            `<div class="pop"><strong>${escapeHtml(nome)}</strong><div>${detalhe}</div>${nota}</div>`,
          )
          .addTo(map)
      })
      map.on('mousemove', (event: MapLayerMouseEvent) => {
        const hit = map.queryRenderedFeatures(event.point, {
          layers: ['bairros-fill', 'bairros-zero'],
        })
        map.getCanvas().style.cursor = hit.length ? 'pointer' : ''
      })

      setPronto(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pronto || !geojson || !votosDoc || !selecao) return

    const qualidade = new Map(votosDoc.bairros.map((item) => [item.id, item.qualidade_coordenada]))
    const totalPorBairro = new Map(
      votosDoc.bairros.map((item) => [item.id, item.votos_candidatos]),
    )
    const denom = modo === 'global' ? selecao.denomGlobal : selecao.denomRel

    const features = geojson.features.map((feature) => {
      const id = Number(feature.properties.id)
      const votos = selecao.votos[String(id)] ?? 0
      const intensidade = votos > 0 && denom > 0 ? Math.min(1, votos / denom) : 0
      return {
        type: 'Feature' as const,
        properties: {
          id,
          nome: feature.properties.nome ?? '',
          votos,
          total: totalPorBairro.get(id) ?? 0,
          intensidade,
          opacidade: votos > 0 ? 0.12 + 0.8 * intensidade : 0,
          qualidade: qualidade.get(id) ?? null,
          rotulo: selecao.rotulo,
        },
        geometry: feature.geometry,
      }
    })

    const source = map.getSource('bairros') as GeoJSONSource | undefined
    source?.setData({ type: 'FeatureCollection', features } as never)
    map.setPaintProperty('bairros-fill', 'fill-color', selecao.cor)

    if (!fittedRef.current) {
      const bounds = new LngLatBounds()
      for (const feature of geojson.features) extendBounds(bounds, feature.geometry)
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 24, duration: 0 })
      fittedRef.current = true
    }
  }, [pronto, geojson, votosDoc, selecao, modo])

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

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map" />

      <section className="panel">
        <header>
          <h1>Mapa Eleitoral de Salvador</h1>
          <p className="sub">Eleições 2024 · 1º turno · dados oficiais do TSE</p>
        </header>

        {erro && <p className="erro">Erro: {erro}</p>}

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
            <span className="swatch" style={{ background: resumo.cor }} />
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
            <span>menos votos</span>
            <span>mais votos</span>
          </div>
          <div className="legenda-zero">
            <span className="hatch" />
            <span>
              {selecao?.tipo === 'total' ? 'sem local de votação' : 'sem votos para a seleção'}
            </span>
          </div>
          <div className="legenda-nota">
            {denominador > 0
              ? `${modo === 'global' ? 'Escala global' : 'Escala do selecionado'}: bairro mais forte com ${nf.format(denominador)} votos`
              : 'Sem dados para a seleção'}
            {' · clique no bairro para detalhes'}
          </div>
        </div>

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
              candidatos.
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
