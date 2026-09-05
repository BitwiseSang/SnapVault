import { useState, useMemo } from 'react'

export interface BarChartDataPoint {
  label: string
  value: number
  subValue?: number
}

interface BarChartProps {
  data: BarChartDataPoint[]
  height?: number
  primaryColor?: string
  subColor?: string
  primaryLabel?: string
  subLabel?: string
  className?: string
}

export function BarChart({
  data,
  height = 240,
  primaryColor = 'var(--color-accent)',
  subColor = 'var(--color-surface-raised)',
  primaryLabel = 'Sent',
  subLabel = 'Received',
  className = '',
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const { maxValue, chartWidth, barWidth, gap } = useMemo(() => {
    let max = 0
    for (const d of data) {
      const total = d.value + (d.subValue ?? 0)
      if (total > max) max = total
    }
    // Prevent division by zero
    if (max === 0) max = 10

    const bWidth = Math.max(14, Math.min(32, Math.floor(600 / (data.length || 1))))
    const bGap = Math.max(6, Math.floor(bWidth * 0.4))
    const totalW = Math.max(600, data.length * (bWidth + bGap) + 40)

    return { maxValue: max, chartWidth: totalW, barWidth: bWidth, gap: bGap }
  }, [data])

  const chartHeight = height - 40 // room for x-axis labels

  return (
    <div className={`w-full overflow-x-auto select-none ${className}`}>
      <svg
        viewBox={`0 0 ${chartWidth} ${height}`}
        className="w-full h-auto min-w-[500px]"
        style={{ minHeight: `${height}px` }}
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chartHeight - ratio * (chartHeight - 20)
          const value = Math.round(maxValue * ratio)
          return (
            <g key={ratio}>
              <line
                x1={30}
                y1={y}
                x2={chartWidth - 10}
                y2={y}
                stroke="var(--color-border)"
                strokeDasharray="4 4"
                strokeWidth={1}
                opacity={0.6}
              />
              <text
                x={25}
                y={y + 3}
                fill="var(--color-text-secondary)"
                fontSize={10}
                textAnchor="end"
                fontFamily="inherit"
              >
                {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = 40 + i * (barWidth + gap)
          const totalVal = d.value + (d.subValue ?? 0)
          const totalBarH = (totalVal / maxValue) * (chartHeight - 20)
          const primaryH = (d.value / maxValue) * (chartHeight - 20)
          const subH = ((d.subValue ?? 0) / maxValue) * (chartHeight - 20)

          const isHovered = hoveredIndex === i

          return (
            <g
              key={d.label}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* Highlight background column on hover */}
              {isHovered && (
                <rect
                  x={x - gap / 2}
                  y={10}
                  width={barWidth + gap}
                  height={chartHeight}
                  fill="var(--color-surface-raised)"
                  opacity={0.5}
                  rx={6}
                />
              )}

              {/* Sub value bar (bottom or stacked) */}
              {subH > 0 && (
                <rect
                  x={x}
                  y={chartHeight - totalBarH}
                  width={barWidth}
                  height={subH}
                  fill={subColor}
                  rx={2}
                  className="transition-all duration-300"
                />
              )}

              {/* Primary bar */}
              <rect
                x={x}
                y={chartHeight - primaryH}
                width={barWidth}
                height={primaryH}
                fill={primaryColor}
                rx={2}
                className="transition-all duration-300"
              />

              {/* X-axis label */}
              {(data.length <= 15 || i % Math.ceil(data.length / 12) === 0) && (
                <text
                  x={x + barWidth / 2}
                  y={height - 10}
                  fill="var(--color-text-secondary)"
                  fontSize={10}
                  textAnchor="middle"
                  fontFamily="inherit"
                >
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip & Legend below */}
      <div className="flex items-center justify-between px-2 pt-2 text-xs text-text-secondary border-t border-border mt-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
            <span>{primaryLabel}</span>
          </div>
          {data.some((d) => (d.subValue ?? 0) > 0) && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: subColor }} />
              <span>{subLabel}</span>
            </div>
          )}
        </div>

        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className="font-medium text-text-primary flex items-center gap-2">
            <span className="font-semibold">{data[hoveredIndex]!.label}:</span>
            <span>
              {data[hoveredIndex]!.value.toLocaleString()} {primaryLabel.toLowerCase()}
            </span>
            {(data[hoveredIndex]!.subValue ?? 0) > 0 && (
              <span>
                + {data[hoveredIndex]!.subValue!.toLocaleString()} {subLabel.toLowerCase()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
