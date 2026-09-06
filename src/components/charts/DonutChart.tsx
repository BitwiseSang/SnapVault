import { useState, useMemo } from 'react'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
  className?: string
}

export function DonutChart({
  segments,
  size = 180,
  strokeWidth = 24,
  centerLabel = 'Total',
  className = '',
}: DonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Leave padding so stroke expansion on hover (+4px) never clips outside viewBox
  const hoverExpansion = 4
  const radius = (size - strokeWidth - hoverExpansion * 2) / 2
  const circumference = 2 * Math.PI * radius

  const total = useMemo(() => {
    return segments.reduce((sum, s) => sum + s.value, 0)
  }, [segments])

  const arcs = useMemo(() => {
    if (total === 0) return []
    let accumulated = 0
    return segments.map((s, i) => {
      const ratio = s.value / total
      const strokeLength = ratio * circumference
      const strokeOffset = -accumulated
      accumulated += strokeLength

      return {
        ...s,
        index: i,
        ratio,
        strokeLength,
        strokeOffset,
        percentage: Math.round(ratio * 100),
      }
    })
  }, [segments, total, circumference])

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-6 ${className}`}>
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[-90deg] select-none overflow-visible"
        >
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
            opacity={0.4}
          />

          {/* Segments */}
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={arc.color}
              strokeWidth={hoveredIdx === arc.index ? strokeWidth + hoverExpansion : strokeWidth}
              strokeDasharray={`${arc.strokeLength} ${circumference - arc.strokeLength}`}
              strokeDashoffset={arc.strokeOffset}
              onMouseEnter={() => setHoveredIdx(arc.index)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="transition-all duration-200 cursor-pointer"
            />
          ))}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-xl font-bold text-text-primary tracking-tight">
            {hoveredIdx !== null && arcs[hoveredIdx]
              ? `${arcs[hoveredIdx]!.percentage}%`
              : total.toLocaleString()}
          </span>
          <span className="text-[10px] text-text-secondary uppercase tracking-wider font-mono">
            {hoveredIdx !== null && arcs[hoveredIdx] ? arcs[hoveredIdx]!.label : centerLabel}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="flex-1 space-y-2 w-full text-xs">
        {arcs.map((arc) => (
          <div
            key={arc.label}
            onMouseEnter={() => setHoveredIdx(arc.index)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer select-none ${
              hoveredIdx === arc.index
                ? 'bg-surface-raised font-medium'
                : 'hover:bg-surface-raised/50 text-text-secondary'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: arc.color }}
              />
              <span className="truncate text-text-primary font-medium">{arc.label}</span>
            </div>

            <div className="flex items-center gap-3 font-mono shrink-0">
              <span className="text-text-secondary">{arc.value.toLocaleString()}</span>
              <span className="font-semibold text-text-primary w-8 text-right">
                {arc.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
