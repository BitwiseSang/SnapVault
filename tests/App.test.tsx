import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

vi.mock('../src/db/db', () => ({
  getLatestImportMeta: vi.fn().mockResolvedValue(null),
  db: {
    events: { toArray: vi.fn().mockResolvedValue([]) },
    meta: { get: vi.fn().mockResolvedValue(null) },
  },
}))

describe('App component', () => {
  it('renders loading state initially and routes to import view when no archive exists', async () => {
    render(<App />)
    expect(screen.getByText('Checking local archive...')).toBeDefined()
    expect(await screen.findByText(/Welcome to SnapVault/i)).toBeDefined()
  })
})
