import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { LngLatBounds, Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl'
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

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
  cor: string
  votos_total: number
  votos_max_bairro: number
  bairros_com_voto: number
  situacao: string
  resultado: string
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
  secoes_por_coordenada: number
  secoes_por_nome: number
  secoes_sem_bairro: number
  locais_distintos: number
  votos_candidatos: number
  votos_atribuidos_bairro: number
  cobertura_votos: number
  max_votos_bairro: number
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
}

type BairroFeature = {
  type: 'Feature'
  properties: { id?: number; nome?: string }
  geometry: { type: string; coordinates: unknown }
}
type BairroCollection = { type: 'FeatureCollection'; features: BairroFeature[] }

type Modo = 'global' | 'relativo'

const nf = new Intl.NumberFormat('pt-BR')

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
        const qualidade = props.qualidade
        const nota =
          typeof qualidade === 'number' && qualidade < 0.999
            ? `<div class="pop-note">${Math.round(qualidade * 100)}% das seções deste bairro localizadas por coordenada</div>`
            : ''
        new Popup({ closeButton: true })
          .setLngLat(event.lngLat)
          .setHTML(
            `<div class="pop"><strong>${escapeHtml(nome)}</strong><div>${nf.format(votos)} votos</div>${nota}</div>`,
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
    if (!map || !pronto || !geojson || !votosDoc || !candidato) return

    const votosCandidato = votosDoc.por_candidato[candidato.id] ?? {}
    const qualidade = new Map(votosDoc.bairros.map((item) => [item.id, item.qualidade_coordenada]))
    const denominador =
      modo === 'global' ? votosDoc.meta.max_votos_bairro : candidato.votos_max_bairro

    const features = geojson.features.map((feature) => {
      const id = Number(feature.properties.id)
      const votos = votosCandidato[String(id)] ?? 0
      const intensidade =
        votos > 0 && denominador > 0 ? Math.min(1, votos / denominador) : 0
      return {
        type: 'Feature' as const,
        properties: {
          id,
          nome: feature.properties.nome ?? '',
          votos,
          intensidade,
          opacidade: votos > 0 ? 0.12 + 0.8 * intensidade : 0,
          qualidade: qualidade.get(id) ?? null,
        },
        geometry: feature.geometry,
      }
    })

    const source = map.getSource('bairros') as GeoJSONSource | undefined
    source?.setData({ type: 'FeatureCollection', features } as never)
    map.setPaintProperty('bairros-fill', 'fill-color', candidato.cor)

    if (!fittedRef.current) {
      const bounds = new LngLatBounds()
      for (const feature of geojson.features) extendBounds(bounds, feature.geometry)
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 24, duration: 0 })
      fittedRef.current = true
    }
  }, [pronto, geojson, votosDoc, candidato, modo])

  const trocarCargo = (id: string) => {
    setCargoId(id)
    const alvo = candDoc?.cargos.find((item) => item.id === id)
    setCandidatoId(alvo?.candidatos[0]?.id ?? '')
  }

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map" />

      <section className="panel">
        <header>
          <h1>Mapa Eleitoral de Salvador</h1>
          <p className="sub">
            Eleições 2024 · 1º turno · dados oficiais do TSE
          </p>
        </header>

        {erro && <p className="erro">Erro: {erro}</p>}

        <div className="controls">
          <label>
            <span>Cargo</span>
            <select value={cargoId} onChange={(event) => trocarCargo(event.target.value)}>
              {candDoc?.cargos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Candidato</span>
            <select
              value={candidatoId}
              onChange={(event) => setCandidatoId(event.target.value)}
            >
              {cargo?.candidatos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome_urna} · {item.partido} ({item.numero}) · {nf.format(item.votos_total)} votos
                </option>
              ))}
            </select>
          </label>
        </div>

        {candidato && (
          <div className="candidato">
            <span className="swatch" style={{ background: candidato.cor }} />
            <div className="candidato-info">
              <strong>{candidato.nome_urna}</strong>
              <span>
                {candidato.partido} · {candidato.cargo} · {nf.format(candidato.votos_total)} votos
              </span>
            </div>
          </div>
        )}

        <div className="modos">
          <button
            type="button"
            className={modo === 'relativo' ? 'ativo' : ''}
            onClick={() => setModo('relativo')}
          >
            Relativa ao candidato
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
          <div className="gradiente" style={{ '--cor': candidato?.cor ?? '#2563eb' } as CSSProperties} />
          <div className="legenda-texto">
            <span>menos votos</span>
            <span>mais votos</span>
          </div>
          <div className="legenda-zero">
            <span className="hatch" />
            <span>sem votos neste bairro</span>
          </div>
        </div>

        {meta && (
          <details className="sobre">
            <summary>Dados e limitações</summary>
            <p>
              {nf.format(meta.secoes_por_coordenada)} de {nf.format(meta.secoes_total)} seções
              localizadas por coordenada; {nf.format(meta.secoes_por_nome)} pelo nome de bairro do
              TSE; {nf.format(meta.secoes_sem_bairro)} sem bairro.
            </p>
            <p>
              {Math.round(meta.cobertura_votos * 100)}% dos votos de candidatos foram atribuídos a um
              bairro. {nf.format(meta.bairros)} bairros oficiais e {nf.format(meta.candidatos)}{' '}
              candidatos.
            </p>
            <p className="fonte">
              Fonte: TSE — Dados Abertos (Eleições Municipais 2024); polígonos: Prefeitura de
              Salvador. Bairro é aproximação de seção/local de votação.
            </p>
          </details>
        )}
      </section>
    </div>
  )
}

export default App
