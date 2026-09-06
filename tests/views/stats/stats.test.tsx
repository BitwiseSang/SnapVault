import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BarChart } from '../../../src/components/charts/BarChart'
import { DonutChart } from '../../../src/components/charts/DonutChart'

describe('BarChart', () => {
  it('renders SVG bar chart with labels and values', () => {
    const data = [
      { label: 'Jan', value: 120, subValue: 40 },
      { label: 'Feb', value: 200, subValue: 80 },
    ]

    render(<BarChart data={data} primaryLabel="Sent" subLabel="Received" />)

    expect(screen.getByText('Jan')).toBeDefined()
    expect(screen.getByText('Feb')).toBeDefined()
    expect(screen.getByText('Sent')).toBeDefined()
    expect(screen.getByText('Received')).toBeDefined()
  })

  it('uses var(--color-sent) and var(--color-received) as the default colors', () => {
    const data = [{ label: 'Jan', value: 100, subValue: 50 }]
    const { container } = render(<BarChart data={data} />)

    const subRect = container.querySelector('rect[fill="var(--color-received)"]')
    expect(subRect).not.toBeNull()

    const primaryRect = container.querySelector('rect[fill="var(--color-sent)"]')
    expect(primaryRect).not.toBeNull()
  })

  it('displays tooltip when hovering anywhere in the column hit area', () => {
    const data = [{ label: 'Jan', value: 2, subValue: 1 }]
    const { container } = render(<BarChart data={data} primaryLabel="Sent" subLabel="Received" />)

    const hitTarget = container.querySelector('rect[style*="pointer-events: all"]')
    expect(hitTarget).not.toBeNull()

    const columnGroup = hitTarget?.closest('g')
    expect(columnGroup).not.toBeNull()

    fireEvent.mouseEnter(columnGroup!)
    expect(screen.getByText(/2 sent/i)).toBeDefined()
    expect(screen.getByText(/\+ 1 received/i)).toBeDefined()

    fireEvent.mouseLeave(columnGroup!)
    expect(screen.queryByText(/2 sent/i)).toBeNull()
  })
})

describe('DonutChart', () => {
  it('renders SVG donut chart with total and segment percentages', () => {
    const segments = [
      { label: 'Photos', value: 75, color: '#FFFC00' },
      { label: 'Videos', value: 25, color: '#38bdf8' },
    ]

    render(<DonutChart segments={segments} centerLabel="Media" />)

    expect(screen.getByText('100')).toBeDefined()
    expect(screen.getByText('Photos')).toBeDefined()
    expect(screen.getByText('75%')).toBeDefined()
    expect(screen.getByText('Videos')).toBeDefined()
    expect(screen.getByText('25%')).toBeDefined()
  })
})
