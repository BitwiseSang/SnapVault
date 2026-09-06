import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
