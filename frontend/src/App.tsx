import { useState } from 'react'
import CreatePoll from './CreatePoll'

function App() {
  const [createdPollId, setCreatedPollId] = useState<string | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      {createdPollId ? (
        <div style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
          <p className="mono-label" style={{ marginBottom: '1rem', color: '#525252' }}>
            Poll Created
          </p>
          <h1 style={{ fontSize: '2rem' }}>Poll ID: {createdPollId}</h1>
          <p style={{ marginTop: '1rem', color: '#525252' }}>
            (Voting screen coming next)
          </p>
        </div>
      ) : (
        <CreatePoll onPollCreated={setCreatedPollId} />
      )}
    </div>
  )
}

export default App