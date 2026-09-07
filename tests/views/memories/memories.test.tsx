import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryCard } from '../../../src/views/memories/MemoryCard'
import { MediaLightbox } from '../../../src/views/memories/MediaLightbox'
import { MemoryEvent } from '../../../src/models/events'

vi.mock('../../../src/db/mediaUrl', () => ({
  useMediaUrl: (path?: string) => ({
    url: path ? `blob:http://localhost/${path}` : null,
    isLoading: false,
  }),
  getCachedMediaUrl: vi.fn().mockResolvedValue(null),
}))

type ObserverCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) => void

// Mock IntersectionObserver
class MockIntersectionObserver {
  private cb: ObserverCallback
  constructor(callback: ObserverCallback) {
    this.cb = callback
  }
  observe = vi.fn(() => {
    this.cb(
      [{ isIntersecting: true } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  })
  unobserve = vi.fn()
  disconnect = vi.fn()
}

window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
HTMLMediaElement.prototype.pause = vi.fn()

describe('MemoryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('renders date label and location when provided', () => {
    const memory: MemoryEvent = {
      id: 'mem_1',
      type: 'memory',
      timestamp: '2026-09-02T15:27:36.000Z',
      mediaFile: 'memories/2026-09-02_xyz-main.jpg',
      mediaKind: 'Image',
      location: 'Latitude, Longitude: 0.55, 35.24',
    }

    render(<MemoryCard memory={memory} onClick={() => {}} />)
    expect(screen.getByText(/Sep 2, 2026/i)).toBeDefined()
    expect(screen.getByText('0.55, 35.24')).toBeDefined()
  })

  it('plays video on card hover and pauses on mouse leave', () => {
    const videoMemory: MemoryEvent = {
      id: 'mem_vid_1',
      type: 'memory',
      timestamp: '2026-09-02T15:27:36.000Z',
      mediaFile: 'memories/2026-09-02_xyz-main.mp4',
      mediaKind: 'Video',
      location: 'Latitude, Longitude: 0.55, 35.24',
    }

    const { container } = render(<MemoryCard memory={videoMemory} onClick={() => {}} />)
    const card = container.firstChild as HTMLElement
    expect(card).not.toBeNull()

    // Hover triggers play on first hover
    fireEvent.mouseEnter(card)
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)

    // Leaving pauses playback
    fireEvent.mouseLeave(card)
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  })

  it('renders video indicator with pointer-events-none to avoid intercepting hover', () => {
    const videoMemory: MemoryEvent = {
      id: 'mem_vid_2',
      type: 'memory',
      timestamp: '2026-09-02T15:27:36.000Z',
      mediaFile: 'memories/2026-09-02_xyz-main.mp4',
      mediaKind: 'Video',
      location: '',
    }

    const { container } = render(<MemoryCard memory={videoMemory} onClick={() => {}} />)
    const badge = container.querySelector('.pointer-events-none.backdrop-blur-xs')
    expect(badge).not.toBeNull()
  })
})

describe('MediaLightbox', () => {
  it('renders media modal with date and counter', () => {
    const memory: MemoryEvent = {
      id: 'mem_1',
      type: 'memory',
      timestamp: '2026-09-02T15:27:36.000Z',
      mediaFile: 'memories/2026-09-02_xyz-main.jpg',
      mediaKind: 'Image',
      location: 'Latitude, Longitude: 0.55, 35.24',
    }

    render(
      <MediaLightbox
        memory={memory}
        currentIndex={3}
        totalCount={10}
        onClose={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    )

    expect(screen.getByText('4 / 10')).toBeDefined()
    expect(screen.getByText(/September 2, 2026/i)).toBeDefined()
  })

  it('renders zoom tool for images and cycles through two zoom levels then resets', () => {
    const memory: MemoryEvent = {
      id: 'mem_zoom_1',
      type: 'memory',
      timestamp: '2026-09-02T15:27:36.000Z',
      mediaFile: 'memories/test_image.jpg',
      mediaKind: 'Image',
      location: '',
    }

    const { container } = render(
      <MediaLightbox
        memory={memory}
        currentIndex={0}
        totalCount={1}
        onClose={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    )

    // Zoom tool button should be present
    const zoomBtn = screen.getByRole('button', { name: /zoom level 1x/i })
    expect(zoomBtn).toBeDefined()
    expect(screen.getByText('1x')).toBeDefined()

    // Find the media display container
    const mediaContainer = container.querySelector('.group.cursor-zoom-in') as HTMLElement
    expect(mediaContainer).not.toBeNull()

    // First click: zooms to Level 1 (2x)
    fireEvent.click(mediaContainer)
    expect(screen.getByText('2x')).toBeDefined()
    expect(screen.getByRole('button', { name: /zoom level 2x/i })).toBeDefined()

    // Second click: zooms to Level 2 (3x)
    fireEvent.click(mediaContainer)
    expect(screen.getByText('3x')).toBeDefined()
    expect(screen.getByRole('button', { name: /zoom level 3x/i })).toBeDefined()
    expect(container.querySelector('.group.cursor-zoom-out')).not.toBeNull()

    // Third click: restores original zoom level (1x)
    fireEvent.click(mediaContainer)
    expect(screen.getByText('1x')).toBeDefined()
    expect(screen.getByRole('button', { name: /zoom level 1x/i })).toBeDefined()
    expect(container.querySelector('.group.cursor-zoom-in')).not.toBeNull()
  })

  it('cycles zoom levels when clicking the floating zoom button directly', () => {
    const memory: MemoryEvent = {
      id: 'mem_zoom_btn',
      type: 'memory',
      timestamp: '2026-09-02T15:27:36.000Z',
      mediaFile: 'memories/test_btn.jpg',
      mediaKind: 'Image',
      location: '',
    }

    render(
      <MediaLightbox
        memory={memory}
        currentIndex={0}
        totalCount={1}
        onClose={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    )

    const zoomBtn = screen.getByRole('button', { name: /zoom level 1x/i })
    fireEvent.click(zoomBtn)
    expect(screen.getByText('2x')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /zoom level 2x/i }))
    expect(screen.getByText('3x')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /zoom level 3x/i }))
    expect(screen.getByText('1x')).toBeDefined()
  })

  it('does not render zoom tool for video memories', () => {
    const videoMemory: MemoryEvent = {
      id: 'mem_video_no_zoom',
      type: 'memory',
      timestamp: '2026-09-02T15:27:36.000Z',
      mediaFile: 'memories/sample.mp4',
      mediaKind: 'Video',
      location: '',
    }

    render(
      <MediaLightbox
        memory={videoMemory}
        currentIndex={0}
        totalCount={1}
        onClose={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    )

    expect(screen.queryByRole('button', { name: /zoom level/i })).toBeNull()
  })

  it('resets zoom level on Escape key before closing modal', () => {
    const memory: MemoryEvent = {
      id: 'mem_esc',
      type: 'memory',
      timestamp: '2026-09-02T15:27:36.000Z',
      mediaFile: 'memories/escape_test.jpg',
      mediaKind: 'Image',
      location: '',
    }

    const onClose = vi.fn()

    const { container } = render(
      <MediaLightbox
        memory={memory}
        currentIndex={0}
        totalCount={1}
        onClose={onClose}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    )

    const mediaContainer = container.querySelector('.group.cursor-zoom-in') as HTMLElement
    // Zoom in
    fireEvent.click(mediaContainer)
    expect(screen.getByText('2x')).toBeDefined()

    // Press Escape: should reset zoom to 1x without triggering onClose
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByText('1x')).toBeDefined()
    expect(onClose).not.toHaveBeenCalled()

    // Press Escape again: should trigger onClose
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
