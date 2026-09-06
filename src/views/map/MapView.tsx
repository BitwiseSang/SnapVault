import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin,
  Image as ImageIcon,
  Video as VideoIcon,
  Maximize2,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { getGeoMemories } from '../../db/db'
import { GeoMemoryEvent, clusterGeoMemories, calculateBounds } from '../../utils/geo'
import { Badge } from '../../components/Badge'
import { IconButton } from '../../components/IconButton'
import { Spinner } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'
import { useApp } from '../../app/AppContext'
import { MapMemoryCard } from './MapMemoryCard'
import { MediaLightbox } from '../memories/MediaLightbox'
import { useMediaUrl } from '../../db/mediaUrl'

type MediaTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO'

const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  },
}

function TrayThumbnail({
  memory,
  isSelected,
  onClick,
}: {
  memory: GeoMemoryEvent
  isSelected: boolean
  onClick: () => void
}) {
  const { url } = useMediaUrl(memory.mediaFile)
  const isVideo = memory.mediaKind === 'Video'

  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 w-16 h-24 rounded-xl overflow-hidden border-2 transition-all cursor-pointer select-none bg-surface-raised ${
        isSelected
          ? 'border-accent shadow-md scale-105 ring-2 ring-accent/30'
          : 'border-border/60 hover:border-text-secondary/60 opacity-80 hover:opacity-100'
      }`}
    >
      {url ? (
        <img
          src={url}
          alt="Snap thumbnail"
          loading="lazy"
          className="w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-text-secondary">
          {isVideo ? <VideoIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
        </div>
      )}

      {isVideo && (
        <div className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white">
          <VideoIcon className="w-2.5 h-2.5" />
        </div>
      )}
    </button>
  )
}

export function MapView() {
  const { theme } = useApp()
  const [memories, setMemories] = useState<GeoMemoryEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>('ALL')
  const [selectedYear, setSelectedYear] = useState<string>('ALL')
  const [selectedMemory, setSelectedMemory] = useState<GeoMemoryEvent | null>(null)
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null)
  const [isTrayOpen, setIsTrayOpen] = useState(false)
  const [currentZoom, setCurrentZoom] = useState<number>(3)
  const [tileModeOverride, setTileModeOverride] = useState<'dark' | 'light' | null>(null)

  const activeTileMode = tileModeOverride ?? (theme === 'light' ? 'light' : 'dark')

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const hasInitiallyFittedRef = useRef<boolean>(false)
  const initialTileModeRef = useRef<'dark' | 'light'>(theme === 'light' ? 'light' : 'dark')

  // Fetch memories with valid coordinates
  useEffect(() => {
    let isMounted = true
    getGeoMemories()
      .then((res) => {
        if (isMounted) {
          setMemories(res)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load geotagged memories:', err)
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Extract available years
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    for (const m of memories) {
      if (m.timestamp) {
        const yr = m.timestamp.slice(0, 4)
        if (yr && !Number.isNaN(Number(yr))) {
          years.add(yr)
        }
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [memories])

  // Filtered memories based on media type & year
  const filteredMemories = useMemo(() => {
    let list = memories
    if (typeFilter === 'IMAGE') {
      list = list.filter((m) => m.mediaKind === 'Image')
    } else if (typeFilter === 'VIDEO') {
      list = list.filter((m) => m.mediaKind === 'Video')
    }

    if (selectedYear !== 'ALL') {
      list = list.filter((m) => m.timestamp.startsWith(selectedYear))
    }

    return list
  }, [memories, typeFilter, selectedYear])

  // Compute clusters for current zoom
  const clusters = useMemo(() => {
    return clusterGeoMemories(filteredMemories, currentZoom)
  }, [filteredMemories, currentZoom])

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const initialCenter: [number, number] = [20, 0]
    const initialZoom = 2

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
    })

    // Custom zoom control position (bottom-right)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const cfg = TILE_LAYERS[initialTileModeRef.current]
    const tileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      subdomains: cfg.subdomains,
      maxZoom: cfg.maxZoom,
    }).addTo(map)

    const markersLayer = L.layerGroup().addTo(map)

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom())
    })

    mapRef.current = map
    tileLayerRef.current = tileLayer
    markersLayerRef.current = markersLayer

    // Resize observer to handle container size changes cleanly
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
    })
    ro.observe(mapContainerRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      markersLayerRef.current = null
    }
  }, [])

  // Update tile layer when activeTileMode changes
  useEffect(() => {
    if (!tileLayerRef.current) return
    const cfg = TILE_LAYERS[activeTileMode]
    tileLayerRef.current.setUrl(cfg.url)
  }, [activeTileMode])

  // Fit all visible memories
  const handleFitAll = useCallback(() => {
    if (!mapRef.current || filteredMemories.length === 0) return
    const bounds = calculateBounds(filteredMemories.map((m) => m.coordinates))
    if (!bounds) return

    if (bounds.minLat === bounds.maxLat && bounds.minLng === bounds.maxLng) {
      mapRef.current.setView([bounds.minLat, bounds.minLng], 14)
    } else {
      mapRef.current.fitBounds(
        [
          [bounds.minLat, bounds.minLng],
          [bounds.maxLat, bounds.maxLng],
        ],
        { padding: [50, 50], maxZoom: 15 },
      )
    }
  }, [filteredMemories])

  // Initial fit when data loads
  useEffect(() => {
    if (!hasInitiallyFittedRef.current && filteredMemories.length > 0 && mapRef.current) {
      handleFitAll()
      hasInitiallyFittedRef.current = true
    }
  }, [filteredMemories, handleFitAll])

  // Render markers and clusters
  useEffect(() => {
    const layer = markersLayerRef.current
    if (!layer || !mapRef.current) return

    layer.clearLayers()

    for (const cluster of clusters) {
      if (cluster.isCluster) {
        const count = cluster.items.length
        const badgeClass =
          count > 99 ? 'w-10 h-10 text-xs' : count > 9 ? 'w-9 h-9 text-xs' : 'w-8 h-8 text-xs'

        const clusterIcon = L.divIcon({
          className: 'snap-map-cluster-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer group select-none">
              <div class="absolute inset-0 rounded-full bg-[#FFFC00]/35 animate-ping opacity-60"></div>
              <div class="${badgeClass} rounded-full bg-[#FFFC00] text-black font-black flex items-center justify-center shadow-lg border-2 border-[#121212] group-hover:scale-115 transition-transform duration-150">
                ${count}
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })

        const marker = L.marker([cluster.center.lat, cluster.center.lng], {
          icon: clusterIcon,
        })

        marker.on('click', () => {
          if (mapRef.current) {
            const nextZoom = Math.min(mapRef.current.getZoom() + 2, 18)
            mapRef.current.flyTo([cluster.center.lat, cluster.center.lng], nextZoom, {
              duration: 0.5,
            })
          }
          if (cluster.items[0]) {
            setSelectedMemory(cluster.items[0])
          }
        })

        marker.addTo(layer)
      } else {
        const item = cluster.items[0]!
        const isVideo = item.mediaKind === 'Video'
        const svgIcon = isVideo
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`
          : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`

        const singleIcon = L.divIcon({
          className: 'snap-map-single-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer group select-none">
              <div class="w-8 h-8 rounded-full bg-[#FFFC00] text-black flex items-center justify-center shadow-lg border-2 border-[#121212] group-hover:scale-120 transition-transform duration-150">
                ${svgIcon}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        const marker = L.marker([item.coordinates.lat, item.coordinates.lng], {
          icon: singleIcon,
        })

        marker.on('click', () => {
          setSelectedMemory(item)
          if (mapRef.current) {
            mapRef.current.panTo([item.coordinates.lat, item.coordinates.lng])
          }
        })

        marker.addTo(layer)
      }
    }
  }, [clusters])

  // Select memory and pan
  const handleSelectMemory = (memory: GeoMemoryEvent) => {
    setSelectedMemory(memory)
    if (mapRef.current) {
      mapRef.current.flyTo([memory.coordinates.lat, memory.coordinates.lng], 15, {
        duration: 0.6,
      })
    }
  }

  // Open lightbox
  const handleOpenLightbox = () => {
    if (!selectedMemory) return
    const idx = filteredMemories.findIndex((m) => m.id === selectedMemory.id)
    setActiveLightboxIndex(idx >= 0 ? idx : 0)
  }

  const handleCloseLightbox = () => {
    setActiveLightboxIndex(null)
  }

  const handlePrevLightbox = () => {
    setActiveLightboxIndex((prev) => {
      if (prev === null) return null
      return prev > 0 ? prev - 1 : filteredMemories.length - 1
    })
  }

  const handleNextLightbox = () => {
    setActiveLightboxIndex((prev) => {
      if (prev === null) return null
      return prev < filteredMemories.length - 1 ? prev + 1 : 0
    })
  }

  const activeLightboxMemory =
    activeLightboxIndex !== null ? (filteredMemories[activeLightboxIndex] ?? null) : null

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-xs text-text-secondary h-full bg-bg">
        <Spinner size="lg" />
        <span>Loading Snap Map...</span>
      </div>
    )
  }

  // Zero memories with GPS in the entire archive
  if (memories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 h-full bg-bg">
        <EmptyState
          icon={<MapPin className="w-8 h-8 text-accent" />}
          title="No Location Data Found"
          description="None of your saved memories contain GPS coordinates. Snapchat exports only include location metadata when location services were turned on when saving the snap."
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg relative">
      {/* Top Controls Bar */}
      <div className="h-14 border-b border-border bg-surface/90 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0 z-10 select-none">
        {/* Left: Title and counter badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-accent text-accent-fg flex items-center justify-center shadow-xs shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-text-primary truncate">
                Snap Map
              </h1>
              <Badge variant="secondary" size="sm">
                {filteredMemories.length} {filteredMemories.length === 1 ? 'memory' : 'memories'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Right: Filters & Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Media Type Filter */}
          <div className="hidden sm:flex items-center bg-surface-raised border border-border rounded-xl p-0.5 text-xs">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-accent text-accent-fg font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('IMAGE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                typeFilter === 'IMAGE'
                  ? 'bg-accent text-accent-fg font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Photos</span>
            </button>
            <button
              onClick={() => setTypeFilter('VIDEO')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                typeFilter === 'VIDEO'
                  ? 'bg-accent text-accent-fg font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <VideoIcon className="w-3 h-3" />
              <span>Videos</span>
            </button>
          </div>

          {/* Year selector */}
          {availableYears.length > 0 && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-xs bg-surface-raised border border-border text-text-primary px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="ALL">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          )}

          {/* Fit all view */}
          <IconButton label="Fit all memories" size="sm" variant="secondary" onClick={handleFitAll}>
            <Maximize2 className="w-3.5 h-3.5" />
          </IconButton>

          {/* Toggle Map Theme */}
          <IconButton
            label={`Switch to ${activeTileMode === 'dark' ? 'light' : 'dark'} map style`}
            size="sm"
            variant="secondary"
            onClick={() => setTileModeOverride(activeTileMode === 'dark' ? 'light' : 'dark')}
          >
            <Layers className="w-3.5 h-3.5" />
          </IconButton>

          {/* Toggle Drawer button */}
          <IconButton
            label={isTrayOpen ? 'Hide memory tray' : 'Show memory tray'}
            size="sm"
            variant={isTrayOpen ? 'accent' : 'secondary'}
            onClick={() => setIsTrayOpen((v) => !v)}
          >
            {isTrayOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </IconButton>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 w-full h-full relative isolate">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Selected Memory Preview Card (Floating overlay) */}
        {selectedMemory && (
          <div className="absolute top-4 left-4 z-20 pointer-events-none max-w-[calc(100vw-2rem)]">
            <MapMemoryCard
              memory={selectedMemory}
              onOpenLightbox={handleOpenLightbox}
              onClose={() => setSelectedMemory(null)}
            />
          </div>
        )}

        {/* Empty filter message */}
        {filteredMemories.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-auto">
            <div className="p-6 bg-surface border border-border rounded-2xl shadow-xl flex flex-col items-center gap-3 text-center max-w-sm">
              <MapPin className="w-8 h-8 text-accent" />
              <h2 className="text-sm font-bold text-text-primary">No Matching Snaps</h2>
              <p className="text-xs text-text-secondary">
                No memories with location data match your selected filters.
              </p>
              <button
                onClick={() => {
                  setTypeFilter('ALL')
                  setSelectedYear('ALL')
                }}
                className="mt-1 px-3 py-1.5 rounded-xl bg-accent text-accent-fg text-xs font-bold hover:opacity-90 transition cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          </div>
        )}

        {/* Bottom Tray / Drawer */}
        {isTrayOpen && filteredMemories.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-surface/95 backdrop-blur-md border-t border-border p-3 flex flex-col gap-2 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-text-primary">
                Located Memories ({filteredMemories.length})
              </span>
              <button
                onClick={() => setIsTrayOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto py-1">
              {filteredMemories.map((m) => (
                <TrayThumbnail
                  key={m.id}
                  memory={m}
                  isSelected={selectedMemory?.id === m.id}
                  onClick={() => handleSelectMemory(m)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {activeLightboxMemory && (
        <MediaLightbox
          memory={activeLightboxMemory}
          currentIndex={activeLightboxIndex!}
          totalCount={filteredMemories.length}
          onClose={handleCloseLightbox}
          onPrev={handlePrevLightbox}
          onNext={handleNextLightbox}
        />
      )}
    </div>
  )
}
