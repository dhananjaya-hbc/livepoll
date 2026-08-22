import { useState } from 'react'
import CreatePoll from './CreatePoll'
import PollView from './pollView'

function App() {
  const [createdPollId, setCreatedPollId] = useState<string | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      {createdPollId ? (
        <PollView pollId={createdPollId} />
      ) : (
        <CreatePoll onPollCreated={setCreatedPollId} />
      )}
    </div>
  )
}

export default App