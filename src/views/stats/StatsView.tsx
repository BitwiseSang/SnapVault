import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  Sparkles,
  Image as ImageIcon,
  PhoneCall,
  Calendar,
  Clock,
  ArrowRight,
  Info,
} from 'lucide-react'
import { getStatsData, StatsData } from '../../db/db'
import { BarChart, BarChartDataPoint } from '../../components/charts/BarChart'
import { DonutChart } from '../../components/charts/DonutChart'
import { Avatar } from '../../components/Avatar'
import { Spinner } from '../../components/Spinner'

type ActivityTab = 'messages' | 'snaps' | 'memories' | 'calls'

export function StatsView() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActivityTab>('messages')
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    getStatsData()
      .then((res) => {
        if (isMounted) {
          setStats(res)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load stats data:', err)
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading || !stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-xs text-text-secondary h-full">
        <Spinner size="lg" />
        <span>Calculating archive statistics...</span>
      </div>
    )
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${seconds % 60}s`
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return 'N/A'
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  // Active chart data
  let chartData: BarChartDataPoint[] = []
  let chartPrimaryLabel = 'Sent'
  let chartSubLabel = 'Received'

  if (activeTab === 'messages') {
    chartData = stats.monthlyMessages
    chartPrimaryLabel = 'Sent'
    chartSubLabel = 'Received'
  } else if (activeTab === 'snaps') {
    chartData = stats.monthlySnaps
    chartPrimaryLabel = 'Sent'
    chartSubLabel = 'Received'
  } else if (activeTab === 'memories') {
    chartData = stats.monthlyMemories
    chartPrimaryLabel = 'Saved'
    chartSubLabel = ''
  } else if (activeTab === 'calls') {
    chartData = stats.monthlyCalls
    chartPrimaryLabel = 'Calls'
    chartSubLabel = ''
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-bg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Activity & Statistics
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Visual breakdown of your chats, snaps, calls, and memories history.
          </p>
        </div>

        {stats.firstEventDate && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs text-text-secondary font-medium">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <span>Active since {formatDate(stats.firstEventDate)}</span>
          </div>
        )}
      </div>

      {/* 1. Top summary metrics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Messages Card */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Total Messages</span>
            <MessageSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {stats.totalMessages.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-text-secondary pt-1 border-t border-border/60">
            <span>{stats.totalMessages.sent.toLocaleString()} sent</span>
            <span>•</span>
            <span>{stats.totalMessages.received.toLocaleString()} received</span>
          </div>
        </div>

        {/* Snaps Card */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Total Snaps</span>
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {stats.totalSnaps.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-text-secondary pt-1 border-t border-border/60">
            <span>{stats.totalSnaps.images.toLocaleString()} photos</span>
            <span>•</span>
            <span>{stats.totalSnaps.videos.toLocaleString()} videos</span>
          </div>
        </div>

        {/* Memories Card */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Saved Memories</span>
            <ImageIcon className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {stats.totalMemories.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-text-secondary pt-1 border-t border-border/60">
            <span>{stats.totalMemories.images.toLocaleString()} photos</span>
            <span>•</span>
            <span>{stats.totalMemories.videos.toLocaleString()} videos</span>
          </div>
        </div>

        {/* Calls Card */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Total Call Time</span>
            <PhoneCall className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-text-primary">
            {formatDuration(stats.totalCalls.totalDurationSec)}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-text-secondary pt-1 border-t border-border/60">
            <span>{stats.totalCalls.completed} completed calls</span>
            <span>•</span>
            <span>~{stats.totalCalls.avgDurationSec}s avg</span>
          </div>
        </div>
      </div>

      {/* 2. Activity Over Time Chart */}
      <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text-primary">Activity Over Time</h2>
            <p className="text-xs text-text-secondary">
              Monthly volume of interactions across all time.
            </p>
          </div>

          {/* Metric tabs */}
          <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-xl border border-border text-xs">
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'messages'
                  ? 'bg-accent text-accent-fg font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => setActiveTab('snaps')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'snaps'
                  ? 'bg-accent text-accent-fg font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Snaps
            </button>
            <button
              onClick={() => setActiveTab('memories')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'memories'
                  ? 'bg-accent text-accent-fg font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Memories
            </button>
            <button
              onClick={() => setActiveTab('calls')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                activeTab === 'calls'
                  ? 'bg-accent text-accent-fg font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Calls
            </button>
          </div>
        </div>

        <BarChart
          data={chartData}
          height={260}
          primaryLabel={chartPrimaryLabel}
          subLabel={chartSubLabel}
        />
      </div>

      {/* 3. Detailed Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Contacted Friends */}
        <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-text-primary">Top 10 Most Contacted</h2>
              <p className="text-xs text-text-secondary">
                Ranked by combined message & snap interactions.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-secondary select-none shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sent" />
                <span>Sent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-received border border-border" />
                <span>Received</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {stats.topContactsOverall.map((c, i) => {
              const maxCount = stats.topContactsOverall[0]?.totalCount || 1
              const percentage = Math.round((c.totalCount / maxCount) * 100)
              const sentRatio = c.totalCount > 0 ? (c.sentCount / c.totalCount) * 100 : 50

              return (
                <div
                  key={c.contact}
                  onClick={() => navigate(`/chats/${encodeURIComponent(c.contact)}`)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-raised transition cursor-pointer group select-none border border-transparent hover:border-border"
                >
                  <span className="font-mono text-xs text-text-secondary w-4 text-center font-semibold">
                    {i + 1}
                  </span>

                  <Avatar name={c.displayName} size="md" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-text-primary truncate">
                        {c.displayName}
                      </span>
                      <span className="font-mono text-text-secondary">
                        {c.totalCount.toLocaleString()}
                      </span>
                    </div>

                    {/* Progress bar split: sent vs received */}
                    <div className="w-full bg-surface-raised h-1.5 rounded-full overflow-hidden mt-1.5 flex border border-border/30">
                      <div
                        className="bg-sent h-full transition-all duration-300"
                        style={{ width: `${(percentage * sentRatio) / 100}%` }}
                        title={`${c.sentCount.toLocaleString()} sent`}
                      />
                      <div
                        className="bg-received h-full transition-all duration-300 border-l border-border/60"
                        style={{ width: `${(percentage * (100 - sentRatio)) / 100}%` }}
                        title={`${c.receivedCount.toLocaleString()} received`}
                      />
                    </div>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-text-secondary opacity-0 group-hover:opacity-100 transition shrink-0" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Right side: Media & Call stats */}
        <div className="space-y-6">
          {/* Snaps Breakdown */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-text-primary">Snap Media Types</h2>
              <p className="text-xs text-text-secondary">Photos vs Videos sent and received.</p>
            </div>

            <DonutChart
              segments={[
                { label: 'Photos', value: stats.totalSnaps.images, color: 'var(--color-accent)' },
                { label: 'Videos', value: stats.totalSnaps.videos, color: '#38bdf8' },
              ]}
              centerLabel="Snaps"
            />

            <div className="flex items-start gap-2 p-3 bg-surface-raised/60 rounded-xl text-[11px] text-text-secondary">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                Snapchat deletes old snaps from its servers, so only your recent snaps appear here.
                Any photos and videos you sent directly in chat never expire and are counted under
                Messages.
              </span>
            </div>
          </div>

          {/* Call History Breakdown */}
          <div className="p-6 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-text-primary">Call Summary</h2>
              <p className="text-xs text-text-secondary">Overview of voice and video calls.</p>
            </div>

            <DonutChart
              segments={[
                { label: 'Video Calls', value: stats.totalCalls.video, color: '#a855f7' },
                { label: 'Audio Calls', value: stats.totalCalls.audio, color: '#34d399' },
              ]}
              centerLabel="Calls"
            />

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center text-xs">
              <div className="p-2 bg-surface-raised rounded-xl">
                <span className="text-[10px] text-text-secondary block">Completed</span>
                <span className="font-bold text-text-primary text-sm">
                  {stats.totalCalls.completed}
                </span>
              </div>
              <div className="p-2 bg-surface-raised rounded-xl">
                <span className="text-[10px] text-text-secondary block">Incoming</span>
                <span className="font-bold text-text-primary text-sm">
                  {stats.totalCalls.incoming}
                </span>
              </div>
              <div className="p-2 bg-surface-raised rounded-xl">
                <span className="text-[10px] text-text-secondary block">Avg Time</span>
                <span className="font-bold text-text-primary text-sm flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-text-secondary" />
                  {stats.totalCalls.avgDurationSec}s
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-surface-raised/60 rounded-xl text-[11px] text-text-secondary">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                Call logs do not record participant usernames. This aggregate view reflects all
                voice and video calls logged by Snapchat.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
