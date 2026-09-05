import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ContactSummary,
  getAllContactSummaries,
  getConversationTimeline,
  TimelineEvent,
} from '../../db/db'
import { ContactList } from './ContactList'
import { ConversationPane } from './ConversationPane'

export function ChatsView() {
  const { contact: urlContact } = useParams<{ contact?: string }>()
  const navigate = useNavigate()

  const [contacts, setContacts] = useState<ContactSummary[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)

  // 1. Fetch contacts list on mount
  useEffect(() => {
    let isMounted = true
    getAllContactSummaries()
      .then((res) => {
        if (isMounted) {
          setContacts(res)
          setIsLoadingContacts(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load contacts:', err)
        if (isMounted) setIsLoadingContacts(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Active contact: decode from URL, or fallback to first contact if available
  const activeContact = useMemo(() => {
    if (urlContact) {
      return decodeURIComponent(urlContact)
    }
    if (contacts.length > 0) {
      return contacts[0]!.contact
    }
    return null
  }, [urlContact, contacts])

  // 2. Fetch events when activeContact changes
  useEffect(() => {
    if (!activeContact) return

    let isMounted = true

    getConversationTimeline(activeContact)
      .then((res) => {
        if (isMounted) {
          setEvents(res)
          setIsLoadingEvents(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load conversation:', err)
        if (isMounted) setIsLoadingEvents(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeContact])

  const totalEventsCount = useMemo(() => {
    return contacts.reduce((sum, c) => sum + c.totalMessages + c.totalSnaps, 0)
  }, [contacts])

  const activeSummary = useMemo(() => {
    if (!activeContact || activeContact === '__all__') return undefined
    return contacts.find((c) => c.contact === activeContact)
  }, [activeContact, contacts])

  const handleSelectContact = (contactId: string) => {
    setIsLoadingEvents(true)
    navigate(`/chats/${encodeURIComponent(contactId)}`)
  }

  if (isLoadingContacts) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
        Loading conversations...
      </div>
    )
  }

  const displayedEvents = activeContact ? events : []

  return (
    <div className="flex-1 flex h-full min-w-0 overflow-hidden">
      <ContactList
        contacts={contacts}
        selectedContact={activeContact}
        onSelectContact={handleSelectContact}
        totalEventsCount={totalEventsCount}
      />

      <ConversationPane
        contact={activeContact}
        summary={activeSummary}
        events={displayedEvents}
        isLoading={isLoadingEvents}
      />
    </div>
  )
}
