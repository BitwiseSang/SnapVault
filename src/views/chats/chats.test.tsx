import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'
import { MessageEvent, SnapEvent } from '../../models/events'

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
})
