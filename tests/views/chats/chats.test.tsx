import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBubble } from '../../../src/views/chats/MessageBubble'
import { compareContacts, ContactList } from '../../../src/views/chats/ContactList'
import { ContactSummary } from '../../../src/db/db'
import { MessageEvent, SnapEvent } from '../../../src/models/events'

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
