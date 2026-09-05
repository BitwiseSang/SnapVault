import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './app/AppContext'
import { MainLayout } from './app/MainLayout'
import { ImportScreen } from './views/import/ImportScreen'
import { ChatsView } from './views/chats/ChatsView'
import { MemoriesView } from './views/memories/MemoriesView'
import { StatsView } from './views/stats/StatsView'
import { Spinner } from './components/Spinner'
import { ErrorBoundary } from './components/ErrorBoundary'

function RootRedirect() {
  const { isReady, isLoadingMeta } = useApp()

  if (isLoadingMeta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg text-text-primary gap-4">
        <Spinner size="lg" />
        <span className="text-xs text-text-secondary font-medium">Checking local archive...</span>
      </div>
    )
  }

  if (!isReady) {
    return <Navigate to="/import" replace />
  }

  return <Navigate to="/chats" replace />
}

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/import" element={<ImportScreen />} />

            <Route element={<MainLayout />}>
              <Route path="/chats" element={<ChatsView />} />
              <Route path="/chats/:contact" element={<ChatsView />} />
              <Route path="/memories" element={<MemoriesView />} />
              <Route path="/stats" element={<StatsView />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  )
}

export default App
