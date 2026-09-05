export function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg text-text-primary">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent text-accent-fg font-black text-2xl shadow-sm">
          SV
        </div>
        <h1 className="text-3xl font-bold tracking-tight">SnapVault</h1>
        <p className="text-sm text-text-secondary">
          Private, local-first browser for your Snapchat data export.
        </p>
      </div>
    </div>
  )
}

export default App
