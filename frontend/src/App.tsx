import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import CreatePoll from './CreatePoll'
import PollView from './pollView'

function CreatePollPage() {
  const navigate = useNavigate()
  return <CreatePoll onPollCreated={(pollId) => navigate(`/poll/${pollId}`)} />
}

function PollPage() {
  const { pollId } = useParams<{ pollId: string }>()
  if (!pollId) return null
  return <PollView pollId={pollId} />
}

function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <Routes>
        <Route path="/" element={<CreatePollPage />} />
        <Route path="/poll/:pollId" element={<PollPage />} />
      </Routes>
    </div>
  )
}

export default App