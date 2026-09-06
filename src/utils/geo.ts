import { MemoryEvent } from '../models/events'

export interface GeoCoordinates {
  lat: number
  lng: number
}

export interface GeoMemoryEvent extends MemoryEvent {
  coordinates: GeoCoordinates
}

export interface GeoCluster {
  id: string
  center: GeoCoordinates
  items: GeoMemoryEvent[]
  isCluster: boolean
}

/**
 * Parses GPS coordinates from a Snapchat location string.
 * Example formats:
 * - "Latitude, Longitude: 0.5560059, 35.24502"
 * - "Latitude, Longitude: -0.1676453, 35.966236"
 * Unset GPS coordinates typically default to "Latitude, Longitude: 0.0, 0.0" and are filtered out.
 */
export function parseCoordinates(locationStr?: string | null): GeoCoordinates | null {
  if (!locationStr || typeof locationStr !== 'string') return null

  const match = locationStr.match(/Latitude,\s*Longitude:\s*([-\d.]+),\s*([-\d.]+)/i)
  if (!match || !match[1] || !match[2]) return null

  const lat = parseFloat(match[1])
  const lng = parseFloat(match[2])

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null

  // Ignore 0.0, 0.0 which represents unset GPS coordinates in Snapchat exports
  if (lat === 0 && lng === 0) return null

  // Geographic bounds validation
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}

/**
 * Formats coordinates into a human-readable string like "0.5560° N, 35.2450° E".
 */
export function formatCoordinates(coords: GeoCoordinates, precision = 4): string {
  const latDir = coords.lat >= 0 ? 'N' : 'S'
  const lngDir = coords.lng >= 0 ? 'E' : 'W'

  const absLat = Math.abs(coords.lat).toFixed(precision)
  const absLng = Math.abs(coords.lng).toFixed(precision)

  return `${absLat}° ${latDir}, ${absLng}° ${lngDir}`
}

/**
 * Calculates geographic bounding box for an array of coordinates.
 */
export function calculateBounds(
  coords: GeoCoordinates[],
): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
  if (coords.length === 0) return null

  let minLat = 90
  let maxLat = -90
  let minLng = 180
  let maxLng = -180

  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat
    if (c.lat > maxLat) maxLat = c.lat
    if (c.lng < minLng) minLng = c.lng
    if (c.lng > maxLng) maxLng = c.lng
  }

  return { minLat, maxLat, minLng, maxLng }
}

/**
 * Projects latitude/longitude to Mercator pixel coordinates at a given zoom level.
 */
function projectToPixel(coords: GeoCoordinates, zoom: number): { x: number; y: number } {
  const scale = 256 * Math.pow(2, zoom)
  const x = ((coords.lng + 180) / 360) * scale

  const sinLat = Math.sin((coords.lat * Math.PI) / 180)
  // Clamp sinLat to avoid infinite projection at poles
  const clampedSinLat = Math.max(-0.9999, Math.min(0.9999, sinLat))
  const y = (0.5 - Math.log((1 + clampedSinLat) / (1 - clampedSinLat)) / (4 * Math.PI)) * scale

  return { x, y }
}

/**
 * Groups nearby GeoMemoryEvents into clusters based on screen pixel distance at the current map zoom.
 */
export function clusterGeoMemories(
  memories: GeoMemoryEvent[],
  zoom: number,
  clusterRadiusPixels = 55,
): GeoCluster[] {
  if (memories.length === 0) return []

  // At high zoom levels (e.g. >= 17), show individual items
  if (zoom >= 17) {
    return memories.map((m) => ({
      id: m.id,
      center: m.coordinates,
      items: [m],
      isCluster: false,
    }))
  }

  const clusters: {
    items: GeoMemoryEvent[]
    pixelX: number
    pixelY: number
    sumLat: number
    sumLng: number
  }[] = []

  for (const memory of memories) {
    const pixel = projectToPixel(memory.coordinates, zoom)
    let closestCluster: (typeof clusters)[0] | null = null
    let closestDistSq = clusterRadiusPixels * clusterRadiusPixels

    for (const cluster of clusters) {
      const dx = cluster.pixelX - pixel.x
      const dy = cluster.pixelY - pixel.y
      const distSq = dx * dx + dy * dy

      if (distSq < closestDistSq) {
        closestDistSq = distSq
        closestCluster = cluster
      }
    }

    if (closestCluster) {
      closestCluster.items.push(memory)
      closestCluster.sumLat += memory.coordinates.lat
      closestCluster.sumLng += memory.coordinates.lng
      // Recalculate average pixel and center
      const count = closestCluster.items.length
      const avgLat = closestCluster.sumLat / count
      const avgLng = closestCluster.sumLng / count
      const avgPixel = projectToPixel({ lat: avgLat, lng: avgLng }, zoom)
      closestCluster.pixelX = avgPixel.x
      closestCluster.pixelY = avgPixel.y
    } else {
      clusters.push({
        items: [memory],
        pixelX: pixel.x,
        pixelY: pixel.y,
        sumLat: memory.coordinates.lat,
        sumLng: memory.coordinates.lng,
      })
    }
  }

  return clusters.map((c, index) => {
    const count = c.items.length
    const center: GeoCoordinates = {
      lat: c.sumLat / count,
      lng: c.sumLng / count,
    }

    return {
      id: count === 1 ? c.items[0]!.id : `cluster_${zoom}_${index}`,
      center,
      items: c.items,
      isCluster: count > 1,
    }
  })
}
