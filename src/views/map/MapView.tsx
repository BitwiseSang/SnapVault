import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin,
  Image as ImageIcon,
  Video as VideoIcon,
  Maximize2,
  Layers,
  Images as GalleryIcon,
} from 'lucide-react'
import { getGeoMemories } from '../../db/db'
import { GeoMemoryEvent, GeoCluster, clusterGeoMemories, calculateBounds } from '../../utils/geo'
import { Badge } from '../../components/Badge'
import { IconButton } from '../../components/IconButton'
import { Spinner } from '../../components/Spinner'
import { EmptyState } from '../../components/EmptyState'
import { useApp } from '../../app/AppContext'
import { MapMemoryCard } from './MapMemoryCard'
import { ClusterExpansionCard } from './ClusterExpansionCard'
import { MapHoverPreview } from './MapHoverPreview'
import { MediaLightbox } from '../memories/MediaLightbox'
import { useMediaUrl } from '../../db/mediaUrl'

type MediaTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO'

function getCartoTileUrl(variant: 'dark' | 'light'): string {
  const apiKey = (
    import.meta.env.CARTO_API_KEY ||
    (import.meta.env as Record<string, string | undefined>).CARTO_API_KEY ||
    ''
  ).trim()
  const path = variant === 'dark' ? 'dark_all' : 'rastertiles/voyager'
  const keyQuery = apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''
  return `https://{s}.basemaps.cartocdn.com/${path}/{z}/{x}/{y}{r}.png${keyQuery}`
}

const TILE_LAYERS = {
  dark: {
    url: getCartoTileUrl('dark'),
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  },
  light: {
    url: getCartoTileUrl('light'),
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
  const { url: overlayUrl } = useMediaUrl(memory.overlayFile)
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
        <>
          {isVideo ? (
            <video
              src={`${url}#t=0.001`}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <img
              src={url}
              alt="Snap thumbnail"
              loading="lazy"
              className="w-full h-full object-cover pointer-events-none"
            />
          )}
          {overlayUrl && (
            <img
              src={overlayUrl}
              alt="Overlay"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
            />
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-text-secondary">
          {isVideo ? <VideoIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
        </div>
      )}

      {isVideo && (
        <div className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white z-20">
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
  const [expandedCluster, setExpandedCluster] = useState<GeoCluster | null>(null)
  const [hoveredData, setHoveredData] = useState<{
    memory?: GeoMemoryEvent
    cluster?: GeoCluster
    x: number
    y: number
  } | null>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  })
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null)
  const [lightboxContext, setLightboxContext] = useState<GeoMemoryEvent[] | null>(null)
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
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelHover = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoveredData(null)
  }, [])

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

    map.on('movestart zoomstart click', () => {
      cancelHover()
    })

    mapRef.current = map
    tileLayerRef.current = tileLayer
    markersLayerRef.current = markersLayer

    // Resize observer to handle container size changes cleanly
    const ro = new ResizeObserver((entries) => {
      map.invalidateSize()
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    ro.observe(mapContainerRef.current)

    return () => {
      cancelHover()
      ro.disconnect()
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      markersLayerRef.current = null
    }
  }, [cancelHover])

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

  // Render markers and clusters (re-runs when clusters or selectedMemory changes)
  useEffect(() => {
    const layer = markersLayerRef.current
    if (!layer || !mapRef.current) return

    layer.clearLayers()

    for (const cluster of clusters) {
      if (cluster.isCluster) {
        const count = cluster.items.length
        const isClusterSelected = Boolean(
          selectedMemory && cluster.items.some((m) => m.id === selectedMemory.id),
        )
        const isClusterExpanded = expandedCluster?.id === cluster.id
        const badgeClass =
          count > 99 ? 'w-10 h-10 text-xs' : count > 9 ? 'w-9 h-9 text-xs' : 'w-8 h-8 text-xs'

        let clusterIcon: L.DivIcon
        if (isClusterSelected || isClusterExpanded) {
          clusterIcon = L.divIcon({
            className: 'snap-map-cluster-marker-selected',
            html: `
              <div class="relative flex items-center justify-center cursor-pointer select-none">
                <div class="${badgeClass} rounded-full bg-[#38bdf8] text-slate-950 font-black flex items-center justify-center shadow-xl border-2 border-white scale-110">
                  ${count}
                </div>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
        } else {
          clusterIcon = L.divIcon({
            className: 'snap-map-cluster-marker',
            html: `
              <div class="relative flex items-center justify-center cursor-pointer group select-none">
                <div class="${badgeClass} rounded-full bg-[#FFFC00] text-black font-black flex items-center justify-center shadow-lg border-2 border-[#121212] group-hover:scale-115 transition-transform duration-150">
                  ${count}
                </div>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
        }

        const marker = L.marker([cluster.center.lat, cluster.center.lng], {
          icon: clusterIcon,
          zIndexOffset: isClusterSelected || isClusterExpanded ? 1000 : 0,
        })

        // Click to expand the cluster and view all memories
        marker.on('click', () => {
          cancelHover()
          setExpandedCluster(cluster)
          setSelectedMemory(cluster.items[0] ?? null)
          if (mapRef.current) {
            mapRef.current.panTo([cluster.center.lat, cluster.center.lng])
          }
        })

        // Debounced hover preview (300ms delay)
        marker.on('mouseover', () => {
          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
          hoverTimeoutRef.current = setTimeout(() => {
            if (!mapRef.current) return
            const pt = mapRef.current.latLngToContainerPoint([
              cluster.center.lat,
              cluster.center.lng,
            ])
            setHoveredData({ cluster, x: pt.x, y: pt.y })
          }, 300)
        })

        marker.on('mouseout', () => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = null
          }
          setHoveredData(null)
        })

        marker.addTo(layer)
      } else {
        const item = cluster.items[0]!
        const isSelected = selectedMemory?.id === item.id

        let singleIcon: L.DivIcon
        if (isSelected) {
          singleIcon = L.divIcon({
            className: 'snap-map-single-marker-selected',
            html: `
              <div class="relative flex items-center justify-center cursor-pointer select-none">
                <div class="w-6 h-6 rounded-full bg-[#38bdf8] border-2 border-white shadow-xl scale-110 flex items-center justify-center"></div>
              </div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          })
        } else {
          // Clean yellow circle without pulsating effect
          singleIcon = L.divIcon({
            className: 'snap-map-single-marker',
            html: `
              <div class="relative flex items-center justify-center cursor-pointer select-none group">
                <div class="w-5 h-5 rounded-full bg-[#FFFC00] border-2 border-[#121212] shadow-md group-hover:scale-125 transition-transform duration-150"></div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })
        }

        const marker = L.marker([item.coordinates.lat, item.coordinates.lng], {
          icon: singleIcon,
          zIndexOffset: isSelected ? 1000 : 0,
        })

        marker.on('click', () => {
          cancelHover()
          setExpandedCluster(null)
          setSelectedMemory(item)
          if (mapRef.current) {
            mapRef.current.panTo([item.coordinates.lat, item.coordinates.lng])
          }
        })

        // Debounced hover preview (300ms delay)
        marker.on('mouseover', () => {
          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
          hoverTimeoutRef.current = setTimeout(() => {
            if (!mapRef.current) return
            const pt = mapRef.current.latLngToContainerPoint([
              item.coordinates.lat,
              item.coordinates.lng,
            ])
            setHoveredData({ memory: item, x: pt.x, y: pt.y })
          }, 300)
        })

        marker.on('mouseout', () => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = null
          }
          setHoveredData(null)
        })

        marker.addTo(layer)
      }
    }
  }, [clusters, selectedMemory, expandedCluster?.id, cancelHover])

  // Select memory and pan (called from tray or cluster list)
  const handleSelectMemory = (memory: GeoMemoryEvent) => {
    cancelHover()
    setSelectedMemory(memory)
    if (expandedCluster && !expandedCluster.items.some((m) => m.id === memory.id)) {
      setExpandedCluster(null)
    }
    if (mapRef.current) {
      mapRef.current.flyTo([memory.coordinates.lat, memory.coordinates.lng], 15, {
        duration: 0.6,
      })
    }
  }

  const handleZoomCluster = (cluster: GeoCluster) => {
    if (mapRef.current) {
      const nextZoom = Math.min(mapRef.current.getZoom() + 2, 18)
      mapRef.current.flyTo([cluster.center.lat, cluster.center.lng], nextZoom, {
        duration: 0.5,
      })
    }
  }

  // Open lightbox
  const handleOpenLightbox = (memoryToOpen?: GeoMemoryEvent, clusterContext?: GeoMemoryEvent[]) => {
    const list = clusterContext ?? filteredMemories
    setLightboxContext(clusterContext ?? null)
    const target = memoryToOpen ?? selectedMemory
    if (!target) return
    const idx = list.findIndex((m) => m.id === target.id)
    setActiveLightboxIndex(idx >= 0 ? idx : 0)
  }

  const handleCloseLightbox = () => {
    setActiveLightboxIndex(null)
    setLightboxContext(null)
  }

  const currentLightboxItems = lightboxContext ?? filteredMemories

  const handlePrevLightbox = () => {
    setActiveLightboxIndex((prev) => {
      if (prev === null) return null
      return prev > 0 ? prev - 1 : currentLightboxItems.length - 1
    })
  }

  const handleNextLightbox = () => {
    setActiveLightboxIndex((prev) => {
      if (prev === null) return null
      return prev < currentLightboxItems.length - 1 ? prev + 1 : 0
    })
  }

  const activeLightboxMemory =
    activeLightboxIndex !== null ? (currentLightboxItems[activeLightboxIndex] ?? null) : null

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

          {/* Toggle Memory Gallery Tray */}
          <IconButton
            label={isTrayOpen ? 'Hide memories gallery tray' : 'Show memories gallery tray'}
            size="sm"
            variant={isTrayOpen ? 'accent' : 'secondary'}
            onClick={() => setIsTrayOpen((v) => !v)}
          >
            <GalleryIcon className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 min-h-0 w-full h-full relative isolate">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 text-xs text-text-secondary bg-bg">
            <Spinner size="lg" />
            <span>Loading Snap Map...</span>
          </div>
        )}

        {/* Zero memories with GPS in the entire archive */}
        {!isLoading && memories.length === 0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-bg">
            <EmptyState
              icon={<MapPin className="w-8 h-8 text-accent" />}
              title="No Location Data Found"
              description="None of your saved memories contain GPS coordinates. Snapchat exports only include location metadata when location services were turned on when saving the snap."
            />
          </div>
        )}

        {/* Expanded Cluster Card (Floating overlay when a cluster node is clicked) */}
        {expandedCluster && (
          <div className="absolute top-4 left-4 z-20 pointer-events-none max-w-[calc(100vw-2rem)]">
            <ClusterExpansionCard
              key={expandedCluster.id}
              cluster={expandedCluster}
              selectedMemoryId={selectedMemory?.id ?? null}
              onSelectMemory={(m) => {
                setSelectedMemory(m)
                if (mapRef.current) {
                  mapRef.current.panTo([m.coordinates.lat, m.coordinates.lng])
                }
              }}
              onOpenLightbox={(m) => handleOpenLightbox(m, expandedCluster.items)}
              onZoomIn={() => handleZoomCluster(expandedCluster)}
              onClose={() => setExpandedCluster(null)}
            />
          </div>
        )}

        {/* Selected Single Memory Preview Card (Floating overlay when a single marker is selected) */}
        {!expandedCluster && selectedMemory && (
          <div className="absolute top-4 left-4 z-20 pointer-events-none max-w-[calc(100vw-2rem)]">
            <MapMemoryCard
              memory={selectedMemory}
              onOpenLightbox={() => handleOpenLightbox(selectedMemory)}
              onClose={() => setSelectedMemory(null)}
            />
          </div>
        )}

        {/* Hover preview tooltip (debounced 300ms, non-blocking) */}
        {hoveredData && activeLightboxIndex === null && (
          <MapHoverPreview
            memory={hoveredData.memory}
            cluster={hoveredData.cluster}
            x={hoveredData.x}
            y={hoveredData.y}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        )}

        {/* Empty filter message */}
        {!isLoading && memories.length > 0 && filteredMemories.length === 0 && (
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
          totalCount={currentLightboxItems.length}
          onClose={handleCloseLightbox}
          onPrev={handlePrevLightbox}
          onNext={handleNextLightbox}
        />
      )}
    </div>
  )
}
