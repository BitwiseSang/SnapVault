import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App component', () => {
  it('renders app title', () => {
    render(<App />)
    expect(screen.getByText('SnapVault')).toBeDefined()
  })
})
