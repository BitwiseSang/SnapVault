import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { MemoryEvent } from '../../models/events'
import { MemoryCard } from './MemoryCard'

interface MediaGridProps {
  memories: MemoryEvent[]
  onSelectMemory: (memory: MemoryEvent, index: number) => void
}

interface PositionedItem {
  memory: MemoryEvent
  index: number
  top: number
  left: number
  width: number
  height: number
}

export function MediaGrid({ memories, onSelectMemory }: MediaGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(800)

  // Measure container dimensions & listen to resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateSize = () => {
      setContainerWidth(el.clientWidth)
      setViewportHeight(el.clientHeight)
    }

    updateSize()

    const ro = new ResizeObserver(() => {
      updateSize()
    })
    ro.observe(el)

    return () => ro.disconnect()
  }, [])

  // Track scroll position for viewport virtualization
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  // Calculate masonry layout positions
  const { positions, totalHeight } = useMemo(() => {
    if (containerWidth <= 0 || memories.length === 0) {
      return { positions: [], totalHeight: 0 }
    }

    const gap = 16
    let numCols = 3
    if (containerWidth < 600) numCols = 1
    else if (containerWidth < 960) numCols = 2
    else if (containerWidth > 1400) numCols = 4

    const colWidth = (containerWidth - (numCols - 1) * gap) / numCols
    const colHeights = new Array(numCols).fill(0)
    const itemHeight = Math.round(colWidth * (16 / 9)) // Snapchat portrait aspect ratio

    const calculated: PositionedItem[] = []

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i]!
      // Find shortest column
      let minCol = 0
      for (let c = 1; c < numCols; c++) {
        if (colHeights[c]! < colHeights[minCol]!) {
          minCol = c
        }
      }

      const top = colHeights[minCol]!
      const left = minCol * (colWidth + gap)

      calculated.push({
        memory,
        index: i,
        top,
        left,
        width: colWidth,
        height: itemHeight,
      })

      colHeights[minCol] += itemHeight + gap
    }

    const maxH = Math.max(...colHeights)
    return { positions: calculated, totalHeight: maxH }
  }, [containerWidth, memories])

  // Viewport intersection virtualization
  const visibleItems = useMemo(() => {
    const OVERSCAN = 600
    const viewMin = Math.max(0, scrollTop - OVERSCAN)
    const viewMax = scrollTop + viewportHeight + OVERSCAN

    return positions.filter((item) => item.top + item.height >= viewMin && item.top <= viewMax)
  }, [positions, scrollTop, viewportHeight])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto min-h-0 w-full relative"
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
        {visibleItems.map((item) => (
          <div
            key={item.memory.id}
            style={{
              position: 'absolute',
              top: `${item.top}px`,
              left: `${item.left}px`,
              width: `${item.width}px`,
              height: `${item.height}px`,
            }}
          >
            <MemoryCard
              memory={item.memory}
              onClick={() => onSelectMemory(item.memory, item.index)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
