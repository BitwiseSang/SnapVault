import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SearchOverlay } from '../../../src/views/search/SearchOverlay'
import { buildSearchIndex } from '../../../src/search'
import { MessageEvent } from '../../../src/models/events'

const mockNavigate = vi.fn()
const mockSetIsSearchOpen = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../../src/app/AppContext', () => ({
  useApp: () => ({
    isSearchOpen: true,
    setIsSearchOpen: mockSetIsSearchOpen,
  }),
}))

describe('SearchOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('updates input synchronously without lag', () => {
    buildSearchIndex([])
    render(
      <MemoryRouter>
        <SearchOverlay />
      </MemoryRouter>,
    )

    const input = screen.getByPlaceholderText(/Search contacts/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'quicktext' } })
    expect(input.value).toBe('quicktext')
  })

  it('navigates through results in visual order without skipping messages', async () => {
    const events: MessageEvent[] = [
      {
        id: 'msg_1',
        type: 'message',
        timestamp: '2026-09-01T12:00:00.000Z',
        contact: 'alex_smith',
        direction: 'received',
        mediaType: 'TEXT',
        content: 'Hey alex here is the first message',
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      },
      {
        id: 'msg_2',
        type: 'message',
        timestamp: '2026-09-02T12:00:00.000Z',
        contact: 'alex_smith',
        direction: 'sent',
        mediaType: 'TEXT',
        content: 'And alex this is the second message',
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      },
    ]

    buildSearchIndex(events)

    const { container } = render(
      <MemoryRouter>
        <SearchOverlay />
      </MemoryRouter>,
    )

    const input = screen.getByPlaceholderText(/Search contacts/i)
    fireEvent.change(input, { target: { value: 'alex' } })

    // Wait for debounced search to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 160))
    })

    // Confirm both contacts and messages sections exist
    expect(screen.getByText(/Contacts \(1\)/i)).toBeDefined()
    expect(screen.getByText(/Messages \(2\)/i)).toBeDefined()

    const overlay = container.firstElementChild as HTMLElement

    // 1. Initial selection is index 0 (Contact: alex_smith)
    // Press ArrowDown -> moves to index 1 (First Message: msg_1)
    // Verify it does NOT skip the first message
    fireEvent.keyDown(overlay, { key: 'ArrowDown' })
    fireEvent.keyDown(overlay, { key: 'Enter' })

    expect(mockNavigate).toHaveBeenCalledWith('/chats/alex_smith?msgId=msg_1')
  })

  it('navigates to the second message when pressing ArrowDown twice', async () => {
    const events: MessageEvent[] = [
      {
        id: 'msg_1',
        type: 'message',
        timestamp: '2026-09-01T12:00:00.000Z',
        contact: 'alex_smith',
        direction: 'received',
        mediaType: 'TEXT',
        content: 'Hey alex here is the first message',
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      },
      {
        id: 'msg_2',
        type: 'message',
        timestamp: '2026-09-02T12:00:00.000Z',
        contact: 'alex_smith',
        direction: 'sent',
        mediaType: 'TEXT',
        content: 'And alex this is the second message',
        isSaved: true,
        mediaIds: '',
        conversationTitle: null,
      },
    ]

    buildSearchIndex(events)

    const { container } = render(
      <MemoryRouter>
        <SearchOverlay />
      </MemoryRouter>,
    )

    const input = screen.getByPlaceholderText(/Search contacts/i)
    fireEvent.change(input, { target: { value: 'alex' } })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 160))
    })

    const overlay = container.firstElementChild as HTMLElement

    // Press ArrowDown twice: Contact (0) -> First Message (1) -> Second Message (2)
    fireEvent.keyDown(overlay, { key: 'ArrowDown' })
    fireEvent.keyDown(overlay, { key: 'ArrowDown' })
    fireEvent.keyDown(overlay, { key: 'Enter' })

    expect(mockNavigate).toHaveBeenCalledWith('/chats/alex_smith?msgId=msg_2')
  })
})
