import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import CreatePoll from './features/polls/CreatePoll'
import PollView from './features/polls/PollView'
import Dashboard from './features/dashboard/Dashboard'
import Analytics from './features/analytics/Analytics'
import ErrorBoundary from './shared/components/ErrorBoundary'
import NotFound from './shared/components/NotFound'


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

function AnalyticsPage() {
  const { pollId } = useParams<{ pollId: string }>()
  if (!pollId) return null
  return (
    <Authenticator>
      {() => <Analytics pollId={pollId} />}
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
          <Route path="/poll/:pollId/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </div>
  )
}

export default App