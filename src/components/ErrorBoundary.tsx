import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { clearDatabase } from '../db/db'
import { Button } from './Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = async () => {
    await clearDatabase()
    window.location.href = '/import'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg text-text-primary">
          <div className="max-w-md w-full p-8 rounded-2xl bg-surface border border-border shadow-xl text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-text-primary">
                Something went wrong
              </h1>
              <p className="text-xs text-text-secondary leading-relaxed">
                An unexpected error occurred while rendering the application. Your export data
                remains safe on your device.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-surface-raised rounded-xl text-left overflow-x-auto border border-border">
                <code className="text-[11px] font-mono text-red-400">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button onClick={this.handleReload} variant="primary" className="w-full">
                <RefreshCw className="w-4 h-4" />
                Reload App
              </Button>
              <Button onClick={this.handleReset} variant="outline" className="w-full">
                <RotateCcw className="w-4 h-4" />
                Reset Data
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
