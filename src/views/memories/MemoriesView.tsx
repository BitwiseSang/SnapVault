import { Image } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'

export function MemoriesView() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Memories Gallery</h1>
          <p className="text-xs text-text-secondary">
            Saved photos and videos from your Snapchat archive.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<Image className="w-6 h-6" />}
          title="Memories Gallery"
          description="Masonry grid will render all saved media here."
        />
      </div>
    </div>
  )
}
