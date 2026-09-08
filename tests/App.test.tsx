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
    expect(await screen.findByText(/Welcome to SnapVault/i, {}, { timeout: 5000 })).toBeDefined()
  })

  it('redirects directly accessed subpaths to /import when no archive exists', async () => {
    window.history.pushState({}, '', '/chats')
    render(<App />)
    expect(await screen.findByText(/Welcome to SnapVault/i, {}, { timeout: 5000 })).toBeDefined()
    expect(window.location.pathname).toBe('/import')
  })
})
