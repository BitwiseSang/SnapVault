import { useState, useTransition } from 'react'
import { Search, X, MessageSquare, Image, User, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useSearch, SearchDoc } from '../../search'

export function SearchOverlay() {
  const { isSearchOpen, setIsSearchOpen } = useApp()
  const [query, setQuery] = useState('')
  const [, startTransition] = useTransition()
  const { results, isSearching } = useSearch(query, 100)
  const navigate = useNavigate()

  if (!isSearchOpen) return null

  const handleClose = () => {
    setQuery('')
    setIsSearchOpen(false)
  }

  const handleSelect = (doc: SearchDoc) => {
    handleClose()
    if (doc.type === 'contact' && doc.contact) {
      navigate(`/chats/${encodeURIComponent(doc.contact)}`)
    } else if (doc.type === 'message' && doc.contact) {
      navigate(`/chats/${encodeURIComponent(doc.contact)}`)
    } else if (doc.type === 'memory') {
      navigate('/memories')
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
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
              const val = e.target.value
              startTransition(() => {
                setQuery(val)
              })
            }}
            placeholder="Search contacts, messages, memories..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
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
        <div className="flex-1 overflow-y-auto p-2">
          {isSearching && (
            <div className="py-6 text-center text-xs text-text-secondary">Searching...</div>
          )}

          {!isSearching && query.trim() && results.length === 0 && (
            <div className="py-12 text-center text-sm text-text-secondary space-y-1">
              <p className="font-semibold text-text-primary">No results found</p>
              <p className="text-xs">No matches for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {!query.trim() && (
            <div className="py-12 text-center text-xs text-text-secondary space-y-1">
              <p className="font-medium text-text-primary">Global Search</p>
              <p>Type contact usernames, saved message text, or memory locations.</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleSelect(doc)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-raised transition cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0">
                      {getIcon(doc.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {doc.title}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1 rounded bg-surface-raised text-text-secondary border border-border">
                          {doc.type}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary truncate mt-0.5">{doc.snippet}</p>
                    </div>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-text-secondary opacity-0 group-hover:opacity-100 transition shrink-0 ml-2" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
