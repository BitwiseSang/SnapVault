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
