import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MapMemoryCard } from '../../../src/views/map/MapMemoryCard'
import { MapView } from '../../../src/views/map/MapView'
import { GeoMemoryEvent } from '../../../src/utils/geo'
import { getGeoMemories } from '../../../src/db/db'
import L from 'leaflet'

vi.mock('../../../src/db/db', () => ({
  getGeoMemories: vi.fn(),
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

  it('renders video element for video memories in the memory tray', async () => {
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

    // Open tray
    const toggleButton = screen.getByLabelText('Show memory tray')
    fireEvent.click(toggleButton)

    // Verify tray is open
    expect(screen.getByText('Located Memories (1)')).toBeDefined()
  })

  it('appends api key to tile layer URL when VITE_CARTO_API_KEY is configured', async () => {
    const tileLayerSpy = vi.spyOn(L, 'tileLayer')

    vi.mocked(getGeoMemories).mockResolvedValue([])

    render(<MapView />)

    expect(await screen.findByText('No Location Data Found')).toBeDefined()
    expect(tileLayerSpy).toHaveBeenCalledWith(expect.stringMatching(/key=/), expect.any(Object))
  })
})
