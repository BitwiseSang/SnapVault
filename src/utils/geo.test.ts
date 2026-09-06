import { describe, expect, it } from 'vitest'
import {
  parseCoordinates,
  formatCoordinates,
  calculateBounds,
  clusterGeoMemories,
  GeoMemoryEvent,
} from './geo'

describe('parseCoordinates', () => {
  it('parses valid positive latitude and longitude', () => {
    const res = parseCoordinates('Latitude, Longitude: 0.5560059, 35.24502')
    expect(res).not.toBeNull()
    expect(res?.lat).toBeCloseTo(0.5560059)
    expect(res?.lng).toBeCloseTo(35.24502)
  })

  it('parses valid negative latitude and longitude', () => {
    const res = parseCoordinates('Latitude, Longitude: -0.1676453, -35.966236')
    expect(res).not.toBeNull()
    expect(res?.lat).toBeCloseTo(-0.1676453)
    expect(res?.lng).toBeCloseTo(-35.966236)
  })

  it('filters out 0.0, 0.0 unset GPS coordinates', () => {
    expect(parseCoordinates('Latitude, Longitude: 0.0, 0.0')).toBeNull()
    expect(parseCoordinates('Latitude, Longitude: 0, 0')).toBeNull()
  })

  it('handles null, undefined, or empty string gracefully', () => {
    expect(parseCoordinates(null)).toBeNull()
    expect(parseCoordinates(undefined)).toBeNull()
    expect(parseCoordinates('')).toBeNull()
    expect(parseCoordinates('   ')).toBeNull()
  })

  it('rejects out of bounds latitude and longitude', () => {
    expect(parseCoordinates('Latitude, Longitude: 95.0, 35.0')).toBeNull()
    expect(parseCoordinates('Latitude, Longitude: -95.0, 35.0')).toBeNull()
    expect(parseCoordinates('Latitude, Longitude: 10.0, 190.0')).toBeNull()
    expect(parseCoordinates('Latitude, Longitude: 10.0, -190.0')).toBeNull()
  })

  it('rejects malformed text', () => {
    expect(parseCoordinates('Not a coordinate string')).toBeNull()
    expect(parseCoordinates('Latitude, Longitude: abc, xyz')).toBeNull()
  })
})

describe('formatCoordinates', () => {
  it('formats positive coordinates with N and E', () => {
    expect(formatCoordinates({ lat: 0.556, lng: 35.245 })).toBe('0.5560° N, 35.2450° E')
  })

  it('formats negative coordinates with S and W', () => {
    expect(formatCoordinates({ lat: -0.1676, lng: -74.006 })).toBe('0.1676° S, 74.0060° W')
  })
})

describe('calculateBounds', () => {
  it('returns null for empty coordinate array', () => {
    expect(calculateBounds([])).toBeNull()
  })

  it('computes correct min/max bounds', () => {
    const coords = [
      { lat: 10, lng: 20 },
      { lat: -5, lng: 50 },
      { lat: 15, lng: -10 },
    ]
    const bounds = calculateBounds(coords)
    expect(bounds).toEqual({
      minLat: -5,
      maxLat: 15,
      minLng: -10,
      maxLng: 50,
    })
  })
})

describe('clusterGeoMemories', () => {
  const createMockMemory = (id: string, lat: number, lng: number): GeoMemoryEvent => ({
    id,
    type: 'memory',
    timestamp: '2026-08-19T15:19:44.000Z',
    mediaFile: `memories/${id}-main.jpg`,
    mediaKind: 'Image',
    location: `Latitude, Longitude: ${lat}, ${lng}`,
    coordinates: { lat, lng },
  })

  it('returns empty array when no memories provided', () => {
    expect(clusterGeoMemories([], 10)).toEqual([])
  })

  it('clusters very close memories together at low zoom', () => {
    const mem1 = createMockMemory('m1', 0.556, 35.245)
    const mem2 = createMockMemory('m2', 0.5561, 35.2451)
    const distant = createMockMemory('m3', 51.5074, -0.1278) // London

    const clusters = clusterGeoMemories([mem1, mem2, distant], 6)
    // mem1 and mem2 should cluster together, distant stays separate
    expect(clusters.length).toBe(2)
    const grouped = clusters.find((c) => c.items.length === 2)
    expect(grouped).toBeDefined()
    expect(grouped?.isCluster).toBe(true)
    expect(grouped?.items.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('separates individual memories at high zoom levels (>= 17)', () => {
    const mem1 = createMockMemory('m1', 0.556, 35.245)
    const mem2 = createMockMemory('m2', 0.5561, 35.2451)

    const clusters = clusterGeoMemories([mem1, mem2], 18)
    expect(clusters.length).toBe(2)
    expect(clusters[0]!.isCluster).toBe(false)
    expect(clusters[1]!.isCluster).toBe(false)
  })
})
