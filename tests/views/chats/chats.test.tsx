import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { MessageBubble } from '../../../src/views/chats/MessageBubble'
import { compareContacts, ContactList } from '../../../src/views/chats/ContactList'
import { ConversationPane } from '../../../src/views/chats/ConversationPane'
import { ContactSummary } from '../../../src/db/db'
import { MessageEvent, SnapEvent } from '../../../src/models/events'
import {
  exportConversationAsJson,
  exportConversationAsMarkdown,
  exportConversationAsPdf,
} from '../../../src/utils/export'

vi.mock('../../../src/utils/export', () => ({
  exportConversationAsJson: vi.fn(),
  exportConversationAsMarkdown: vi.fn(),
  exportConversationAsPdf: vi.fn(),
}))

vi.mock('../../../src/db/mediaUrl', () => ({
  useMediaUrl: (path?: string) => ({
    url: path ? `blob:http://localhost/${path}` : null,
    isLoading: false,
  }),
  getCachedMediaUrl: vi.fn().mockResolvedValue(null),
}))

describe('MessageBubble', () => {
  it('renders text message correctly when content is present', () => {
    const msg: MessageEvent = {
      id: 'msg_1',
      type: 'message',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'alice',
      direction: 'received',
      mediaType: 'TEXT',
      content: 'Hey there!',
      isSaved: true,
      mediaIds: '',
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} />)
    expect(screen.getByText('Hey there!')).toBeDefined()
  })

  it('renders media placeholder when content is null', () => {
    const msg: MessageEvent = {
      id: 'msg_2',
      type: 'message',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'bob',
      direction: 'sent',
      mediaType: 'MEDIA',
      content: null,
      isSaved: false,
      mediaIds: 'xyz',
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} />)
    expect(screen.getByText(/Media attachment/i)).toBeDefined()
  })

  it('renders snap event correctly', () => {
    const snap: SnapEvent = {
      id: 'snap_1',
      type: 'snap',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'charlie',
      direction: 'received',
      mediaType: 'VIDEO',
      conversationTitle: null,
    }

    render(<MessageBubble event={snap} />)
    expect(screen.getByText('Received Snap')).toBeDefined()
    expect(screen.getByText('Video')).toBeDefined()
  })

  it('renders recipient label for sent messages when showSenderName is true', () => {
    const msg: MessageEvent = {
      id: 'msg_3',
      type: 'message',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'dave',
      direction: 'sent',
      mediaType: 'TEXT',
      content: 'Hey Dave!',
      isSaved: false,
      mediaIds: '',
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} showSenderName={true} />)
    expect(screen.getByText('To: @dave')).toBeDefined()
  })

  it('renders sender label for received messages when showSenderName is true', () => {
    const msg: MessageEvent = {
      id: 'msg_4',
      type: 'message',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'sarah',
      direction: 'received',
      mediaType: 'TEXT',
      content: 'Hey back!',
      isSaved: false,
      mediaIds: '',
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} showSenderName={true} />)
    expect(screen.getByText('@sarah')).toBeDefined()
  })

  it('applies highlight ring when isHighlighted is true', () => {
    const msg: MessageEvent = {
      id: 'msg_5',
      type: 'message',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'sarah',
      direction: 'received',
      mediaType: 'TEXT',
      content: 'Highlighted message',
      isSaved: false,
      mediaIds: '',
      conversationTitle: null,
    }

    const { container } = render(<MessageBubble event={msg} isHighlighted={true} />)
    const bubble = container.querySelector('.ring-accent')
    expect(bubble).not.toBeNull()
  })

  it('renders chat media grid when chatMediaFiles are present', () => {
    const msg: MessageEvent = {
      id: 'msg_media_1',
      type: 'message',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'sarah',
      direction: 'received',
      mediaType: 'MEDIA',
      content: 'Look at this photo',
      isSaved: false,
      mediaIds: 'sample_id',
      chatMediaFiles: ['chat_media/2026-09-05_sample.jpg'],
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} />)
    expect(screen.getByText('Look at this photo')).toBeDefined()
  })

  it('renders audio note with play button when chatMediaFiles are present', () => {
    const msg: MessageEvent = {
      id: 'msg_note_1',
      type: 'message',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'sarah',
      direction: 'received',
      mediaType: 'NOTE',
      content: null,
      isSaved: true,
      mediaIds: 'audio_id',
      chatMediaFiles: ['chat_media/2026-09-05_audio.mp4'],
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} />)
    expect(screen.queryByText('Audio Note')).toBeNull()
    expect(screen.getByTitle('Play voice note')).toBeDefined()
    expect(screen.getByText('Saved')).toBeDefined()
  })

  it('opens fullscreen lightbox via portal on media click and closes on close button', () => {
    const msg: MessageEvent = {
      id: 'msg_media_lightbox',
      type: 'message',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'sarah',
      direction: 'received',
      mediaType: 'MEDIA',
      content: null,
      isSaved: false,
      mediaIds: 'sample_id',
      chatMediaFiles: ['chat_media/2026-09-05_sample.jpg', 'chat_media/2026-09-05_sample2.jpg'],
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} />)

    // Click on media tile to open lightbox
    const mediaTile = screen.getAllByAltText('Chat attachment')[0]
    expect(mediaTile).toBeDefined()
    fireEvent.click(mediaTile!)

    // Modal dialog should be attached to document.body via portal
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeDefined()
    expect(document.body.contains(dialog)).toBe(true)
    expect(screen.getByText('1 / 2')).toBeDefined()

    // Next item button
    const nextBtn = screen.getByTitle('Next (Right arrow)')
    fireEvent.click(nextBtn)
    expect(screen.getByText('2 / 2')).toBeDefined()

    // Close button
    const closeBtn = screen.getByTitle('Close (Esc)')
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders unwrapped media without bubble and with floating timestamp when caption is absent', () => {
    const msg: MessageEvent = {
      id: 'msg_media_no_cap',
      type: 'message',
      timestamp: '2026-09-05T12:34:00.000Z',
      contact: 'sarah',
      direction: 'received',
      mediaType: 'MEDIA',
      content: null,
      isSaved: true,
      mediaIds: 'sample_id',
      chatMediaFiles: ['chat_media/2026-09-05_sample.jpg'],
      conversationTitle: null,
    }

    const { container } = render(<MessageBubble event={msg} />)
    expect(screen.getByAltText('Chat attachment')).toBeDefined()
    // Should NOT have standard bubble wrapper class
    expect(container.querySelector('.bg-surface-raised.px-3\\.5')).toBeNull()
    // Saved bookmark and floating time badge should exist
    expect(screen.getByTitle('Saved in chat')).toBeDefined()
  })

  it('renders unwrapped media with wrapped caption bubble underneath when caption is present', () => {
    const msg: MessageEvent = {
      id: 'msg_media_with_cap',
      type: 'message',
      timestamp: '2026-09-05T12:34:00.000Z',
      contact: 'sarah',
      direction: 'sent',
      mediaType: 'MEDIA',
      content: 'Check out this sunset!',
      isSaved: false,
      mediaIds: 'sample_id',
      chatMediaFiles: ['chat_media/2026-09-05_sample.jpg'],
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} />)
    expect(screen.getByAltText('Chat attachment')).toBeDefined()
    const captionEl = screen.getByText('Check out this sunset!')
    expect(captionEl).toBeDefined()
    // Caption element should be inside the sent bubble
    const captionBubble = captionEl.closest('.bg-sent')
    expect(captionBubble).not.toBeNull()
  })

  it('renders voice note with wrapped caption bubble underneath when caption is present', () => {
    const msg: MessageEvent = {
      id: 'msg_note_with_cap',
      type: 'message',
      timestamp: '2026-09-05T12:34:00.000Z',
      contact: 'sarah',
      direction: 'received',
      mediaType: 'NOTE',
      content: 'Listen closely',
      isSaved: true,
      mediaIds: 'audio_id',
      chatMediaFiles: ['chat_media/2026-09-05_audio.mp4'],
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} />)
    expect(screen.queryByText('Audio Note')).toBeNull()
    expect(screen.getByTitle('Play voice note')).toBeDefined()
    const captionEl = screen.getByText('Listen closely')
    expect(captionEl).toBeDefined()
    // Caption is inside received bubble
    const captionBubble = captionEl.closest('.bg-surface-raised')
    expect(captionBubble).not.toBeNull()
  })

  it('omits redundant caption when content is literally "Voice note"', () => {
    const msg: MessageEvent = {
      id: 'msg_redundant_note',
      type: 'message',
      timestamp: '2026-09-05T12:34:00.000Z',
      contact: 'sarah',
      direction: 'received',
      mediaType: 'NOTE',
      content: 'Voice note',
      isSaved: false,
      mediaIds: 'audio_id',
      chatMediaFiles: ['chat_media/2026-09-05_audio.mp4'],
      conversationTitle: null,
    }

    render(<MessageBubble event={msg} />)
    expect(screen.getByTitle('Play voice note')).toBeDefined()
    expect(screen.queryByText('Voice note')).toBeNull()
    expect(screen.queryByText('Audio Note')).toBeNull()
  })

  it('renders fallback Audio Note card when NOTE event has no attached file without chat bubble wrapping', () => {
    const msg: MessageEvent = {
      id: 'msg_no_file_note',
      type: 'message',
      timestamp: '2026-09-05T12:34:00.000Z',
      contact: 'sarah',
      direction: 'received',
      mediaType: 'NOTE',
      content: null,
      isSaved: false,
      mediaIds: 'audio_id',
      chatMediaFiles: [],
      conversationTitle: null,
    }

    const { container } = render(<MessageBubble event={msg} />)
    expect(screen.getByText('Audio Note')).toBeDefined()
    // Should NOT be wrapped in a standard chat bubble (no asymmetric speech bubble tail corners)
    expect(container.querySelector('.rounded-bl-xs')).toBeNull()
    expect(container.querySelector('.rounded-br-xs')).toBeNull()
  })

  it('renders Snap message as an unwrapped standalone card without double bubble wrapping', () => {
    const snap: SnapEvent = {
      id: 'snap_unwrapped',
      type: 'snap',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'charlie',
      direction: 'received',
      mediaType: 'IMAGE',
      conversationTitle: null,
    }

    const { container } = render(<MessageBubble event={snap} />)
    expect(screen.getByText('Received Snap')).toBeDefined()
    expect(screen.getByText('Photo')).toBeDefined()
    // Standalone card without chat bubble tail corners
    expect(container.querySelector('.rounded-bl-xs')).toBeNull()
    expect(container.querySelector('.rounded-br-xs')).toBeNull()
  })

  it('renders Sticker message as an unwrapped standalone card', () => {
    const msg: MessageEvent = {
      id: 'msg_sticker',
      type: 'message',
      timestamp: '2026-09-05T12:00:00.000Z',
      contact: 'sarah',
      direction: 'sent',
      mediaType: 'STICKER',
      content: null,
      isSaved: true,
      mediaIds: '',
      conversationTitle: null,
    }

    const { container } = render(<MessageBubble event={msg} />)
    expect(screen.getByText('Sticker')).toBeDefined()
    expect(container.querySelector('.rounded-bl-xs')).toBeNull()
    expect(container.querySelector('.rounded-br-xs')).toBeNull()
  })
})

describe('compareContacts sorting logic', () => {
  const alice: ContactSummary = {
    contact: 'alice',
    displayName: 'Alice Cooper',
    totalMessages: 100,
    totalTexts: 80,
    totalMedia: 20,
    totalSnaps: 5,
    totalSaved: 40,
    lastActivity: '2026-09-01T10:00:00.000Z',
    isGroup: false,
  }

  const bob: ContactSummary = {
    contact: 'bob',
    displayName: 'Bob Dylan',
    totalMessages: 50,
    totalTexts: 20,
    totalMedia: 30,
    totalSnaps: 50,
    totalSaved: 10,
    lastActivity: '2026-09-05T12:00:00.000Z',
    isGroup: false,
  }

  it('sorts by text messages descending and ascending', () => {
    // Descending: Alice (80 texts) should come before Bob (20 texts)
    expect(compareContacts(alice, bob, 'texts', 'desc')).toBeLessThan(0)
    // Ascending: Bob should come before Alice
    expect(compareContacts(alice, bob, 'texts', 'asc')).toBeGreaterThan(0)
  })

  it('sorts by media attachments descending and ascending', () => {
    // Descending: Bob (30 media) should come before Alice (20 media)
    expect(compareContacts(bob, alice, 'media', 'desc')).toBeLessThan(0)
    // Ascending: Alice should come before Bob
    expect(compareContacts(bob, alice, 'media', 'asc')).toBeGreaterThan(0)
  })

  it('sorts by snaps descending and ascending', () => {
    // Descending: Bob (50 snaps) should come before Alice (5 snaps)
    expect(compareContacts(bob, alice, 'snaps', 'desc')).toBeLessThan(0)
    // Ascending: Alice should come before Bob
    expect(compareContacts(bob, alice, 'snaps', 'asc')).toBeGreaterThan(0)
  })

  it('sorts alphabetically by name ascending and descending', () => {
    // Ascending: Alice before Bob
    expect(compareContacts(alice, bob, 'name', 'asc')).toBeLessThan(0)
    // Descending: Bob before Alice
    expect(compareContacts(alice, bob, 'name', 'desc')).toBeGreaterThan(0)
  })

  it('sorts by recent activity descending and ascending', () => {
    // Descending: Bob (Sept 5) before Alice (Sept 1)
    expect(compareContacts(bob, alice, 'recent', 'desc')).toBeLessThan(0)
    // Ascending: Alice before Bob
    expect(compareContacts(bob, alice, 'recent', 'asc')).toBeGreaterThan(0)
  })

  it('sorts by total activity descending and ascending', () => {
    // Alice total = 100 + 5 = 105; Bob total = 50 + 50 = 100
    // Descending: Alice before Bob
    expect(compareContacts(alice, bob, 'total', 'desc')).toBeLessThan(0)
    // Ascending: Bob before Alice
    expect(compareContacts(alice, bob, 'total', 'asc')).toBeGreaterThan(0)
  })

  it('sorts by saved messages descending and ascending', () => {
    // Descending: Alice (40 saved) before Bob (10 saved)
    expect(compareContacts(alice, bob, 'saved', 'desc')).toBeLessThan(0)
    // Ascending: Bob before Alice
    expect(compareContacts(alice, bob, 'saved', 'asc')).toBeGreaterThan(0)
  })
})

describe('ContactList component', () => {
  const mockContacts: ContactSummary[] = [
    {
      contact: 'alice',
      displayName: 'Alice Cooper',
      totalMessages: 100,
      totalTexts: 80,
      totalMedia: 20,
      totalSnaps: 5,
      totalSaved: 40,
      lastActivity: '2026-09-01T10:00:00.000Z',
      isGroup: false,
    },
    {
      contact: 'bob',
      displayName: 'Bob Dylan',
      totalMessages: 50,
      totalTexts: 20,
      totalMedia: 30,
      totalSnaps: 50,
      totalSaved: 10,
      lastActivity: '2026-09-05T12:00:00.000Z',
      isGroup: false,
    },
  ]

  it('renders sort controls and allows changing sort field and direction', () => {
    const onSelect = vi.fn()
    render(
      <ContactList
        contacts={mockContacts}
        selectedContact="alice"
        onSelectContact={onSelect}
        totalEventsCount={155}
      />,
    )

    expect(screen.getByText('Chats')).toBeDefined()
    const sortButton = screen.getByRole('button', { name: /sort conversations/i })
    expect(sortButton).toBeDefined()

    // Open sort menu
    fireEvent.click(sortButton)
    expect(screen.getByText('Sort conversations by')).toBeDefined()
    expect(screen.getByText('Text Messages')).toBeDefined()
    expect(screen.getByText('Media Attachments')).toBeDefined()
    expect(screen.getByText('Snaps Exchanged')).toBeDefined()

    // Select Text Messages
    fireEvent.click(screen.getByText('Text Messages'))
    expect(screen.queryByText('Sort conversations by')).toBeNull()

    // Toggle direction button
    const directionButton = screen.getByLabelText(/invert sort direction/i)
    fireEvent.click(directionButton)
  })
})

describe('ConversationPane component', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)
  })

  const mockEvents: MessageEvent[] = [
    {
      id: 'msg_1',
      type: 'message',
      timestamp: '2026-09-01T10:00:00.000Z',
      contact: 'alice',
      direction: 'received',
      mediaType: 'TEXT',
      content: 'Hello Alice 1',
      isSaved: false,
      mediaIds: '',
      conversationTitle: null,
    },
    {
      id: 'msg_2',
      type: 'message',
      timestamp: '2026-09-02T10:00:00.000Z',
      contact: 'alice',
      direction: 'sent',
      mediaType: 'TEXT',
      content: 'Hello Alice 2',
      isSaved: true,
      mediaIds: '',
      conversationTitle: null,
    },
    {
      id: 'msg_3',
      type: 'message',
      timestamp: '2026-09-03T10:00:00.000Z',
      contact: 'alice',
      direction: 'received',
      mediaType: 'MEDIA',
      content: null,
      isSaved: false,
      mediaIds: 'xyz',
      conversationTitle: null,
    },
  ]

  it('renders empty state when no contact is selected', () => {
    render(
      <MemoryRouter>
        <ConversationPane contact={null} events={[]} isLoading={false} />
      </MemoryRouter>,
    )
    expect(screen.getByText('No conversation selected')).toBeDefined()
  })

  it('renders loading state when isLoading is true', () => {
    render(
      <MemoryRouter>
        <ConversationPane contact="alice" events={[]} isLoading={true} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Loading conversation...')).toBeDefined()
  })

  it('renders message events when loaded', () => {
    render(
      <MemoryRouter>
        <ConversationPane contact="alice" events={mockEvents} isLoading={false} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Hello Alice 1')).toBeDefined()
    expect(screen.getByText('Hello Alice 2')).toBeDefined()
  })

  it('filters by category when filter buttons are clicked', () => {
    render(
      <MemoryRouter>
        <ConversationPane contact="alice" events={mockEvents} isLoading={false} />
      </MemoryRouter>,
    )
    // Click Text Messages filter
    const textFilterBtn = screen.getByRole('button', { name: /text messages/i })
    fireEvent.click(textFilterBtn)
    expect(screen.getByText('Hello Alice 1')).toBeDefined()
    expect(screen.getByText('Hello Alice 2')).toBeDefined()

    // Click Saved filter
    const savedFilterBtn = screen.getByRole('button', { name: /saved/i })
    fireEvent.click(savedFilterBtn)
    expect(screen.queryByText('Hello Alice 1')).toBeNull()
    expect(screen.getByText('Hello Alice 2')).toBeDefined()
  })

  it('toggles sort order when sort button is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/chats/alice']}>
        <Routes>
          <Route
            path="/chats/:contact"
            element={<ConversationPane contact="alice" events={mockEvents} isLoading={false} />}
          />
        </Routes>
      </MemoryRouter>,
    )
    const sortBtn = screen.getByRole('button', { name: /sorting:/i })
    expect(sortBtn).toBeDefined()
    fireEvent.click(sortBtn)
  })

  it('highlights target message when msgId is in search params', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/chats/alice?msgId=msg_2']}>
        <Routes>
          <Route
            path="/chats/:contact"
            element={<ConversationPane contact="alice" events={mockEvents} isLoading={false} />}
          />
        </Routes>
      </MemoryRouter>,
    )
    const highlighted = container.querySelector('.ring-accent')
    expect(highlighted).not.toBeNull()
  })

  it('triggers scroll to bottom on initial load', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    render(
      <MemoryRouter initialEntries={['/chats/alice']}>
        <Routes>
          <Route
            path="/chats/:contact"
            element={<ConversationPane contact="alice" events={mockEvents} isLoading={false} />}
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(rafSpy).toHaveBeenCalled()
    rafSpy.mockRestore()
  })

  it('triggers scroll to bottom when sort order is newest_first', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    render(
      <MemoryRouter initialEntries={['/chats/alice?sort=newest_first']}>
        <Routes>
          <Route
            path="/chats/:contact"
            element={<ConversationPane contact="alice" events={mockEvents} isLoading={false} />}
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(rafSpy).toHaveBeenCalled()
    rafSpy.mockRestore()
  })

  it('renders large message histories without manual batching limits', () => {
    const manyEvents: MessageEvent[] = Array.from({ length: 200 }, (_, i) => ({
      id: `bulk_msg_${i}`,
      type: 'message',
      timestamp: new Date(2026, 0, 1, 0, i).toISOString(),
      contact: 'alice',
      direction: i % 2 === 0 ? 'sent' : 'received',
      mediaType: 'TEXT',
      content: `Message number ${i}`,
      isSaved: false,
      mediaIds: '',
      conversationTitle: null,
    }))

    render(
      <MemoryRouter initialEntries={['/chats/alice']}>
        <Routes>
          <Route
            path="/chats/:contact"
            element={<ConversationPane contact="alice" events={manyEvents} isLoading={false} />}
          />
        </Routes>
      </MemoryRouter>,
    )

    // Verify beginning of conversation marker exists for the whole list
    expect(screen.getByText('Beginning of conversation')).toBeDefined()
    // Verify there are no "Loading earlier messages..." buttons since all events are fully virtualized
    expect(screen.queryByText('Loading earlier messages...')).toBeNull()
    expect(screen.queryByText('Loading older messages...')).toBeNull()
  })

  it('renders export conversation menu and triggers exports on click', () => {
    render(
      <MemoryRouter initialEntries={['/chats/alice']}>
        <Routes>
          <Route
            path="/chats/:contact"
            element={<ConversationPane contact="alice" events={mockEvents} isLoading={false} />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const exportBtn = screen.getByLabelText('Export conversation')
    expect(exportBtn).toBeDefined()
    expect(exportBtn.hasAttribute('disabled')).toBe(false)

    // Click to open menu
    fireEvent.click(exportBtn)
    expect(screen.getByRole('menu')).toBeDefined()

    // Test Markdown option
    const mdOption = screen.getByText(/Markdown for AI/i)
    fireEvent.click(mdOption)
    expect(exportConversationAsMarkdown).toHaveBeenCalledWith('alice', undefined, mockEvents)

    // Re-open and test PDF option
    fireEvent.click(exportBtn)
    const pdfOption = screen.getByText(/Print \/ Save as PDF/i)
    fireEvent.click(pdfOption)
    expect(exportConversationAsPdf).toHaveBeenCalledWith('alice', undefined, mockEvents)

    // Re-open and test JSON option
    fireEvent.click(exportBtn)
    const jsonOption = screen.getByText(/Raw JSON/i)
    fireEvent.click(jsonOption)
    expect(exportConversationAsJson).toHaveBeenCalledWith('alice', undefined, mockEvents)
  })

  it('disables export button when events list is empty', () => {
    render(
      <MemoryRouter initialEntries={['/chats/alice']}>
        <Routes>
          <Route
            path="/chats/:contact"
            element={<ConversationPane contact="alice" events={[]} isLoading={false} />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const exportBtn = screen.getByLabelText('Export conversation')
    expect(exportBtn.hasAttribute('disabled')).toBe(true)
  })

  it('filters by category when mobile select dropdown changes', () => {
    render(
      <MemoryRouter>
        <ConversationPane contact="alice" events={mockEvents} isLoading={false} />
      </MemoryRouter>,
    )
    const select = screen.getByRole('combobox', { name: /filter messages/i })
    expect(select).toBeDefined()

    // Change to SAVED
    fireEvent.change(select, { target: { value: 'SAVED' } })
    expect(screen.queryByText('Hello Alice 1')).toBeNull()
    expect(screen.getByText('Hello Alice 2')).toBeDefined()
  })

  it('omits redundant handle when displayName matches username', () => {
    const summary: ContactSummary = {
      contact: 'alice',
      displayName: 'alice',
      totalMessages: 2,
      totalSnaps: 0,
      totalTexts: 2,
      totalMedia: 0,
      totalSaved: 1,
      lastActivity: '2026-09-01T10:05:00.000Z',
      isGroup: false,
    }

    render(
      <MemoryRouter>
        <ConversationPane contact="alice" summary={summary} events={mockEvents} isLoading={false} />
      </MemoryRouter>,
    )

    // Only one instance of alice should appear (the title)
    expect(screen.getAllByText('alice').length).toBe(1)
    expect(screen.queryByText('@alice')).toBeNull()
  })
})
