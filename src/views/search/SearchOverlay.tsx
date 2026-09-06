import { useState, useMemo, useRef, KeyboardEvent } from 'react'
import { Search, X, MessageSquare, Image, User, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useSearch, SearchDoc } from '../../search'

export function SearchOverlay() {
  const { isSearchOpen, setIsSearchOpen } = useApp()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { results, isSearching } = useSearch(query, 100)
  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)

  // Group results by category (hook must be called unconditionally)
  const grouped = useMemo(() => {
    const contacts: SearchDoc[] = []
    const messages: SearchDoc[] = []
    const memories: SearchDoc[] = []

    for (const r of results) {
      if (r.type === 'contact') contacts.push(r)
      else if (r.type === 'message') messages.push(r)
      else if (r.type === 'memory') memories.push(r)
    }

    return { contacts, messages, memories }
  }, [results])

  const visualResults = useMemo(() => {
    return [...grouped.contacts, ...grouped.messages, ...grouped.memories]
  }, [grouped])

  if (!isSearchOpen) return null

  const safeSelectedIndex = Math.min(selectedIndex, Math.max(0, visualResults.length - 1))

  const handleClose = () => {
    setQuery('')
    setSelectedIndex(0)
    setIsSearchOpen(false)
  }

  const handleSelect = (doc: SearchDoc) => {
    handleClose()
    if (doc.type === 'contact' && doc.contact) {
      navigate(`/chats/${encodeURIComponent(doc.contact)}`)
    } else if (doc.type === 'message' && doc.contact) {
      navigate(`/chats/${encodeURIComponent(doc.contact)}?msgId=${encodeURIComponent(doc.id)}`)
    } else if (doc.type === 'memory') {
      navigate('/memories')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < visualResults.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (visualResults[safeSelectedIndex]) {
        handleSelect(visualResults[safeSelectedIndex]!)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleClose()
    }
  }

  const getIcon = (type: SearchDoc['type']) => {
    switch (type) {
      case 'contact':
        return <User className="w-4 h-4 text-sky-500" />
      case 'message':
        return <MessageSquare className="w-4 h-4 text-emerald-500" />
      case 'memory':
        return <Image className="w-4 h-4 text-amber-500" />
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-4 h-4 text-text-secondary shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Search contacts, saved messages, memories..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('')
                setSelectedIndex(0)
              }}
              className="p-1 text-text-secondary hover:text-text-primary transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] font-mono bg-surface-raised border border-border px-1.5 py-0.5 rounded text-text-secondary">
            ESC
          </kbd>
        </div>

        {/* Results container */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-3">
          {isSearching && (
            <div className="py-6 text-center text-xs text-text-secondary">Searching...</div>
          )}

          {!isSearching && query.trim() && visualResults.length === 0 && (
            <div className="py-12 text-center text-sm text-text-secondary space-y-1">
              <p className="font-semibold text-text-primary">No results found</p>
              <p className="text-xs">No matches for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {!query.trim() && (
            <div className="py-12 text-center text-xs text-text-secondary space-y-1">
              <p className="font-medium text-text-primary">Global Search</p>
              <p>Type contact usernames, saved message text, or memory dates and locations.</p>
            </div>
          )}

          {visualResults.length > 0 && (
            <>
              {/* Contacts section */}
              {grouped.contacts.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-secondary font-semibold">
                    Contacts ({grouped.contacts.length})
                  </div>
                  {grouped.contacts.map((doc) => {
                    const visualIdx = visualResults.indexOf(doc)
                    const isFocused = safeSelectedIndex === visualIdx
                    return (
                      <div
                        key={doc.id}
                        ref={(node) => {
                          if (isFocused && node) {
                            node.scrollIntoView({ block: 'nearest' })
                          }
                        }}
                        onClick={() => handleSelect(doc)}
                        onMouseEnter={() => setSelectedIndex(visualIdx)}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer select-none ${
                          isFocused
                            ? 'bg-accent/15 border border-accent/30 text-text-primary'
                            : 'hover:bg-surface-raised text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0">
                            {getIcon(doc.type)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-text-primary truncate block">
                              {doc.title}
                            </span>
                            <span className="text-[11px] text-text-secondary truncate block">
                              @{doc.contact}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Messages section */}
              {grouped.messages.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-secondary font-semibold">
                    Messages ({grouped.messages.length})
                  </div>
                  {grouped.messages.map((doc) => {
                    const visualIdx = visualResults.indexOf(doc)
                    const isFocused = safeSelectedIndex === visualIdx
                    return (
                      <div
                        key={doc.id}
                        ref={(node) => {
                          if (isFocused && node) {
                            node.scrollIntoView({ block: 'nearest' })
                          }
                        }}
                        onClick={() => handleSelect(doc)}
                        onMouseEnter={() => setSelectedIndex(visualIdx)}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer select-none ${
                          isFocused
                            ? 'bg-accent/15 border border-accent/30 text-text-primary'
                            : 'hover:bg-surface-raised text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0">
                            {getIcon(doc.type)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-text-primary truncate block">
                              {doc.title}
                            </span>
                            <p className="text-[11px] text-text-secondary truncate">
                              {doc.snippet}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-text-secondary shrink-0 ml-2">
                          {doc.date}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Memories section */}
              {grouped.memories.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-secondary font-semibold">
                    Memories ({grouped.memories.length})
                  </div>
                  {grouped.memories.map((doc) => {
                    const visualIdx = visualResults.indexOf(doc)
                    const isFocused = safeSelectedIndex === visualIdx
                    return (
                      <div
                        key={doc.id}
                        ref={(node) => {
                          if (isFocused && node) {
                            node.scrollIntoView({ block: 'nearest' })
                          }
                        }}
                        onClick={() => handleSelect(doc)}
                        onMouseEnter={() => setSelectedIndex(visualIdx)}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition cursor-pointer select-none ${
                          isFocused
                            ? 'bg-accent/15 border border-accent/30 text-text-primary'
                            : 'hover:bg-surface-raised text-text-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0">
                            {getIcon(doc.type)}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-text-primary truncate block">
                              {doc.title}
                            </span>
                            <p className="text-[11px] text-text-secondary truncate">
                              {doc.snippet}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-text-secondary shrink-0 ml-2">
                          {doc.date}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hints */}
        {visualResults.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[10px] text-text-secondary bg-surface-raised">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="bg-surface border border-border px-1 py-0.5 rounded">↑</kbd>{' '}
                <kbd className="bg-surface border border-border px-1 py-0.5 rounded">↓</kbd> to
                navigate
              </span>
              <span>
                <kbd className="bg-surface border border-border px-1.5 py-0.5 rounded">↵</kbd> to
                select
              </span>
            </div>
            <span>{visualResults.length} results</span>
          </div>
        )}
      </div>
    </div>
  )
}
