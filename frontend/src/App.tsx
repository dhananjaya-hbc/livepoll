import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import CreatePoll from './CreatePoll'
import PollView from './PollView'

function CreatePollPage() {
  const navigate = useNavigate()
  return (
    <Authenticator>
      {() => <CreatePoll onPollCreated={(pollId) => navigate(`/poll/${pollId}`)} />}
    </Authenticator>
  )
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