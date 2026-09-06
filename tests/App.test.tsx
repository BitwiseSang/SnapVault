import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

describe('App component', () => {
  it('renders loading state initially while checking database', () => {
    render(<App />)
    expect(screen.getByText('Checking local archive...')).toBeDefined()
  })
})
