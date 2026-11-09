import { useEffect, useRef, useState } from 'react'
import { LngLatBounds, Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'

const BASE = import.meta.env.BASE_URL

type BairroFeature = {
  type: 'Feature'
  properties: { id?: number; nome?: string }
  geometry: { type: string; coordinates: unknown }
}

type BairroCollection = {
  type: 'FeatureCollection'
  features: BairroFeature[]
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

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Carregando bairros…')
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-38.5, -12.97],
      zoom: 10.4,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    let cancelled = false

    map.on('load', async () => {
      try {
        const response = await fetch(`${BASE}geo/bairros.geojson`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const geojson = (await response.json()) as BairroCollection
        if (cancelled) return

        map.addSource('bairros', { type: 'geojson', data: geojson })
        map.addLayer({
          id: 'bairros-fill',
          type: 'fill',
          source: 'bairros',
          paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.22 },
        })
        map.addLayer({
          id: 'bairros-line',
          type: 'line',
          source: 'bairros',
          paint: { 'line-color': '#1e293b', 'line-width': 0.7, 'line-opacity': 0.7 },
        })

        const bounds = new LngLatBounds()
        for (const feature of geojson.features) extendBounds(bounds, feature.geometry)
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 24, duration: 0 })

        map.on('click', 'bairros-fill', (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0]
          if (!feature) return
          const nome = String(feature.properties?.nome ?? 'Bairro')
          new Popup({ closeButton: true })
            .setLngLat(event.lngLat)
            .setHTML(`<strong>${escapeHtml(nome)}</strong>`)
            .addTo(map)
        })
        map.on('mouseenter', 'bairros-fill', () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'bairros-fill', () => {
          map.getCanvas().style.cursor = ''
        })

        setCount(geojson.features.length)
        setStatus('')
      } catch (error) {
        setStatus(`Erro ao carregar bairros: ${(error as Error).message}`)
      }
    })

    return () => {
      cancelled = true
      map.remove()
    }
  }, [])

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map" />
      <header className="hud">
        <h1>Mapa Eleitoral de Salvador 2024</h1>
        {status ? (
          <p className="status">{status}</p>
        ) : (
          <p className="status">
            {count} bairros · fonte oficial <span className="sep">•</span> resultado eleitoral em breve
          </p>
        )}
      </header>
    </div>
  )
}

export default App
