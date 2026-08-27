import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import CreatePoll from './CreatePoll'
import PollView from './PollView'
import Dashboard from './Dashboard'
import ErrorBoundary from './ErrorBoundary'
import NotFound from './NotFound'


function CreatePollPage() {
  const navigate = useNavigate()
  return (
    <Authenticator>
      {() => <CreatePoll onPollCreated={(pollId) => navigate(`/poll/${pollId}`)} />}
    </Authenticator>
  )
}

function DashboardPage() {
  return (
    <Authenticator>
      {() => <Dashboard />}
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
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<CreatePollPage />} />
          <Route path="/poll/:pollId" element={<PollPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}

export default App