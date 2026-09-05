import { MessageSquare } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'

export function ChatsView() {
  return (
    <div className="flex-1 flex h-full">
      <div className="w-80 border-r border-border p-4 bg-surface/50">
        <h2 className="text-sm font-bold text-text-primary mb-3">Conversations</h2>
        <div className="text-xs text-text-secondary">Chats list will render here.</div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<MessageSquare className="w-6 h-6" />}
          title="Select a conversation"
          description="Choose a contact from the list to view chat and snap history."
        />
      </div>
    </div>
  )
}
