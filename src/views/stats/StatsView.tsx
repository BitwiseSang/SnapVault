import { BarChart2 } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'

export function StatsView() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Activity & Statistics
          </h1>
          <p className="text-xs text-text-secondary">
            Summary and trends across your messages, snaps, and calls.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<BarChart2 className="w-6 h-6" />}
          title="Activity Dashboard"
          description="Analytics and charts will render here."
        />
      </div>
    </div>
  )
}
