import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryCard } from './MemoryCard'
import { MediaLightbox } from './MediaLightbox'
import { MemoryEvent } from '../../models/events'

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

describe('MemoryCard', () => {
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
})
