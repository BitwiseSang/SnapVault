import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MapMemoryCard } from '../../../src/views/map/MapMemoryCard'
import { ClusterExpansionCard } from '../../../src/views/map/ClusterExpansionCard'
import { MapHoverPreview } from '../../../src/views/map/MapHoverPreview'
import { MapView } from '../../../src/views/map/MapView'
import { GeoMemoryEvent, GeoCluster } from '../../../src/utils/geo'
import { getGeoMemories } from '../../../src/db/db'
import L from 'leaflet'

vi.mock('../../../src/db/db', () => ({
  getGeoMemories: vi.fn(),
  getMediaBlob: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../../src/app/AppContext', () => ({
  useApp: () => ({ theme: 'dark' }),
}))

describe('MapMemoryCard', () => {
  const sampleGeoMemory: GeoMemoryEvent = {
    id: 'mem_geo_1',
    type: 'memory',
    timestamp: '2026-08-19T12:19:00.000Z',
    mediaFile: 'memories/2026-08-19_snap.jpg',
    overlayFile: 'memories/2026-08-19_snap-overlay.png',
    mediaKind: 'Image',
    location: 'Latitude, Longitude: 0.5560059, 35.24502',
    coordinates: {
      lat: 0.5560059,
      lng: 35.24502,
    },
  }

  it('renders photo memory card with formatted coordinates and date', () => {
    const handleOpen = vi.fn()
    const handleClose = vi.fn()

    render(
      <MapMemoryCard memory={sampleGeoMemory} onOpenLightbox={handleOpen} onClose={handleClose} />,
    )

    expect(screen.getByText('Photo Memory')).toBeDefined()
    expect(screen.getByText(/0.5560° N, 35.2450° E/)).toBeDefined()
    expect(screen.getByText('Open Full Media')).toBeDefined()

    // Test open lightbox action
    fireEvent.click(screen.getByText('Open Full Media'))
    expect(handleOpen).toHaveBeenCalledTimes(1)

    // Test close action
    fireEvent.click(screen.getByLabelText('Close card'))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('renders video memory badge for video kind', () => {
    const videoMemory: GeoMemoryEvent = {
      ...sampleGeoMemory,
      id: 'mem_geo_2',
      mediaKind: 'Video',
    }

    render(<MapMemoryCard memory={videoMemory} onOpenLightbox={() => {}} onClose={() => {}} />)

    expect(screen.getByText('Video Memory')).toBeDefined()
  })
})

describe('ClusterExpansionCard', () => {
  const mockCluster: GeoCluster = {
    id: 'cluster_test_1',
    center: { lat: 0.556, lng: 35.245 },
    isCluster: true,
    items: [
      {
        id: 'mem_c1',
        type: 'memory',
        timestamp: '2026-08-19T12:00:00.000Z',
        mediaFile: 'memories/1.jpg',
        mediaKind: 'Image',
        location: 'Latitude, Longitude: 0.556, 35.245',
        coordinates: { lat: 0.556, lng: 35.245 },
      },
      {
        id: 'mem_c2',
        type: 'memory',
        timestamp: '2026-08-19T14:00:00.000Z',
        mediaFile: 'memories/2.mp4',
        mediaKind: 'Video',
        location: 'Latitude, Longitude: 0.556, 35.245',
        coordinates: { lat: 0.556, lng: 35.245 },
      },
    ],
  }

  it('renders cluster header with memory count and coordinates', () => {
    const onSelect = vi.fn()
    const onOpenLightbox = vi.fn()
    const onZoom = vi.fn()
    const onClose = vi.fn()

    render(
      <ClusterExpansionCard
        cluster={mockCluster}
        selectedMemoryId="mem_c1"
        onSelectMemory={onSelect}
        onOpenLightbox={onOpenLightbox}
        onZoomIn={onZoom}
        onClose={onClose}
      />,
    )

    expect(screen.getByText('2 Memories at this Location')).toBeDefined()
    expect(screen.getByText(/0.5560° N, 35.2450° E/)).toBeDefined()
    expect(screen.getByText('Open Fullscreen')).toBeDefined()
    expect(screen.getByText('Selected Photo')).toBeDefined()
    expect(screen.getByText('2 memories in this cluster')).toBeDefined()

    // Test select memory
    const items = screen.getAllByText('Aug 19, 26')
    if (items[1]) {
      fireEvent.click(items[1])
      expect(onSelect).toHaveBeenCalledWith(mockCluster.items[1])
    }

    // Test open fullscreen lightbox from footer
    fireEvent.click(screen.getByText('Open Fullscreen'))
    expect(onOpenLightbox).toHaveBeenCalledWith(mockCluster.items[0])

    // Test close
    fireEvent.click(screen.getByLabelText('Close cluster view'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('supports pagination with load more button for clusters with many memories', () => {
    const manyItems: GeoMemoryEvent[] = Array.from({ length: 40 }, (_, i) => ({
      id: `mem_${i}`,
      type: 'memory',
      timestamp: '2026-08-19T12:00:00.000Z',
      mediaFile: `memories/${i}.jpg`,
      mediaKind: 'Image',
      location: 'Latitude, Longitude: 0.556, 35.245',
      coordinates: { lat: 0.556, lng: 35.245 },
    }))

    const clusterWithMany: GeoCluster = {
      id: 'cluster_many',
      center: { lat: 0.556, lng: 35.245 },
      isCluster: true,
      items: manyItems,
    }

    render(
      <ClusterExpansionCard
        cluster={clusterWithMany}
        selectedMemoryId="mem_0"
        onSelectMemory={vi.fn()}
        onOpenLightbox={vi.fn()}
        onZoomIn={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('40 Memories at this Location')).toBeDefined()
    expect(screen.getByText('Load more (10 remaining)')).toBeDefined()

    // Click load more
    fireEvent.click(screen.getByText('Load more (10 remaining)'))

    // Button should be gone as all 40 are visible
    expect(screen.queryByText(/Load more/i)).toBeNull()
  })
})

describe('MapHoverPreview', () => {
  const mockMemory: GeoMemoryEvent = {
    id: 'mem_h1',
    type: 'memory',
    timestamp: '2026-08-19T12:00:00.000Z',
    mediaFile: 'memories/hover.jpg',
    mediaKind: 'Image',
    location: 'Latitude, Longitude: 0.556, 35.245',
    coordinates: { lat: 0.556, lng: 35.245 },
  }

  it('renders hover preview card with formatted date and coordinates', () => {
    render(
      <MapHoverPreview
        memory={mockMemory}
        x={200}
        y={300}
        containerWidth={800}
        containerHeight={600}
      />,
    )

    expect(screen.getByText(/Aug 19, 2026/)).toBeDefined()
    expect(screen.getByText('Photo')).toBeDefined()
    expect(screen.getByText(/0.56° N, 35.24° E/)).toBeDefined()
  })
})

describe('MapView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      },
    )
  })

  it('renders empty state when no memories have location data', async () => {
    vi.mocked(getGeoMemories).mockResolvedValue([])

    render(<MapView />)

    expect(await screen.findByText('No Location Data Found')).toBeDefined()
  })

  it('renders snap map UI with counter badge and controls when geotagged memories exist', async () => {
    vi.mocked(getGeoMemories).mockResolvedValue([
      {
        id: 'mem_1',
        type: 'memory',
        timestamp: '2026-08-19T12:00:00.000Z',
        mediaFile: 'memories/1.jpg',
        mediaKind: 'Image',
        location: 'Latitude, Longitude: 0.556, 35.245',
        coordinates: { lat: 0.556, lng: 35.245 },
      },
      {
        id: 'mem_2',
        type: 'memory',
        timestamp: '2026-08-20T14:00:00.000Z',
        mediaFile: 'memories/2.mp4',
        mediaKind: 'Video',
        location: 'Latitude, Longitude: -1.286, 36.817',
        coordinates: { lat: -1.286, lng: 36.817 },
      },
    ])

    render(<MapView />)

    expect(await screen.findByText('Snap Map')).toBeDefined()
    expect(screen.getByText(/2 memories/i)).toBeDefined()
    expect(screen.getByText('Photos')).toBeDefined()
    expect(screen.getByText('Videos')).toBeDefined()
  })

  it('does not include pulsating animate-ping classes in created markers', async () => {
    const divIconSpy = vi.spyOn(L, 'divIcon')

    vi.mocked(getGeoMemories).mockResolvedValue([
      {
        id: 'mem_1',
        type: 'memory',
        timestamp: '2026-08-19T12:00:00.000Z',
        mediaFile: 'memories/1.jpg',
        mediaKind: 'Image',
        location: 'Latitude, Longitude: 0.556, 35.245',
        coordinates: { lat: 0.556, lng: 35.245 },
      },
    ])

    render(<MapView />)
    expect(await screen.findByText(/1 memory/i)).toBeDefined()
    expect(divIconSpy.mock.calls.length).toBeGreaterThan(0)

    for (const call of divIconSpy.mock.calls) {
      const html = call[0]?.html || ''
      expect(html).not.toContain('animate-ping')
    }
  })

  it('toggles memory tray using the gallery icon button', async () => {
    vi.mocked(getGeoMemories).mockResolvedValue([
      {
        id: 'mem_video_1',
        type: 'memory',
        timestamp: '2026-08-20T14:00:00.000Z',
        mediaFile: 'memories/sample_video.mp4',
        mediaKind: 'Video',
        location: 'Latitude, Longitude: -1.286, 36.817',
        coordinates: { lat: -1.286, lng: 36.817 },
      },
    ])

    render(<MapView />)
    expect(await screen.findByText('Snap Map')).toBeDefined()

    // Toggle tray using updated gallery button label
    const toggleButton = screen.getByLabelText('Show memories gallery tray')
    fireEvent.click(toggleButton)

    // Verify tray is open
    expect(screen.getByText('Located Memories (1)')).toBeDefined()

    // Verify tray thumbnail can be selected
    const trayContainer = screen.getByText('Located Memories (1)').closest('div')?.parentElement
    const thumbButton = trayContainer?.querySelectorAll('button')[1]
    if (thumbButton) {
      fireEvent.click(thumbButton)
    }
  })

  it('highlights the memory node on the map when selected from the memory tray', async () => {
    const divIconSpy = vi.spyOn(L, 'divIcon')

    vi.mocked(getGeoMemories).mockResolvedValue([
      {
        id: 'mem_1',
        type: 'memory',
        timestamp: '2026-08-20T14:00:00.000Z',
        mediaFile: 'memories/sample_photo.jpg',
        mediaKind: 'Image',
        location: 'Latitude, Longitude: -1.286, 36.817',
        coordinates: { lat: -1.286, lng: 36.817 },
      },
    ])

    render(<MapView />)
    expect(await screen.findByText('Snap Map')).toBeDefined()

    // Open tray
    const toggleButton = screen.getByLabelText('Show memories gallery tray')
    fireEvent.click(toggleButton)

    // Click memory in tray
    const trayContainer = screen.getByText('Located Memories (1)').closest('div')?.parentElement
    const thumbButton = trayContainer?.querySelectorAll('button')[1]
    expect(thumbButton).toBeDefined()
    fireEvent.click(thumbButton!)

    // Verify divIcon was called with selected sky-blue highlight
    const selectedIconCall = divIconSpy.mock.calls.find((call) =>
      call[0]?.className?.includes('selected'),
    )
    expect(selectedIconCall).toBeDefined()
    expect(selectedIconCall![0]?.html).toContain('bg-[#38bdf8]')
  })

  it('isolates fullscreen lightbox to cluster items when opened from cluster expansion card', async () => {
    const markerSpy = vi.spyOn(L, 'marker')

    vi.mocked(getGeoMemories).mockResolvedValue([
      {
        id: 'mem_cluster_1',
        type: 'memory',
        timestamp: '2026-08-19T12:00:00.000Z',
        mediaFile: 'memories/cluster1.jpg',
        mediaKind: 'Image',
        location: 'Latitude, Longitude: 0.556, 35.245',
        coordinates: { lat: 0.556, lng: 35.245 },
      },
      {
        id: 'mem_cluster_2',
        type: 'memory',
        timestamp: '2026-08-19T13:00:00.000Z',
        mediaFile: 'memories/cluster2.jpg',
        mediaKind: 'Image',
        location: 'Latitude, Longitude: 0.556, 35.245',
        coordinates: { lat: 0.556, lng: 35.245 },
      },
      {
        id: 'mem_other_3',
        type: 'memory',
        timestamp: '2026-08-20T14:00:00.000Z',
        mediaFile: 'memories/other3.jpg',
        mediaKind: 'Image',
        location: 'Latitude, Longitude: 51.5074, -0.1278',
        coordinates: { lat: 51.5074, lng: -0.1278 },
      },
    ])

    render(<MapView />)
    expect(await screen.findByText(/3 memories/i)).toBeDefined()

    expect(markerSpy.mock.results.length).toBeGreaterThan(0)
    const clusterMarker = markerSpy.mock.results
      .map((r) => r.value as L.Marker)
      .find((m) => {
        const pos = m?.getLatLng?.()
        return pos && Math.abs(pos.lat - 0.556) < 0.01
      })
    expect(clusterMarker).toBeDefined()

    // Click cluster marker to open expansion modal
    clusterMarker!.fire('click')

    // Verify cluster expansion card is displayed
    expect(await screen.findByText('2 Memories at this Location')).toBeDefined()
    expect(screen.getByText('2 memories in this cluster')).toBeDefined()

    // Click 'Open Fullscreen' in the cluster modal
    fireEvent.click(screen.getByText('Open Fullscreen'))

    // Lightbox should show count matching the cluster (2), NOT total memories (3)
    expect(screen.getByText('1 / 2')).toBeDefined()

    // Navigate to next item in lightbox: should show 2 / 2
    fireEvent.click(screen.getByLabelText(/next memory/i))
    expect(screen.getByText('2 / 2')).toBeDefined()

    // Next again should loop back within cluster: 1 / 2
    fireEvent.click(screen.getByLabelText(/next memory/i))
    expect(screen.getByText('1 / 2')).toBeDefined()
  })

  it('appends api key to tile layer URL when VITE_CARTO_API_KEY is configured', async () => {
    const tileLayerSpy = vi.spyOn(L, 'tileLayer')

    vi.mocked(getGeoMemories).mockResolvedValue([])

    render(<MapView />)

    expect(await screen.findByText('No Location Data Found')).toBeDefined()
    expect(tileLayerSpy).toHaveBeenCalledWith(expect.stringMatching(/key=/), expect.any(Object))
  })
})
