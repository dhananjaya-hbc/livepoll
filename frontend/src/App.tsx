import { useEffect, useState } from 'react'
import { generateClient } from 'aws-amplify/api'

const getPollQuery = /* GraphQL */ `
  query GetPoll($pollId: ID!) {
    getPoll(pollId: $pollId) {
      pollId
      question
      options
      voteCounts
      status
    }
  }
`

function App() {
  const [result, setResult] = useState<string>('Loading...')

  useEffect(() => {
    async function testConnection() {
      try {
        const client = generateClient()
        const response = await client.graphql({
          query: getPollQuery,
          variables: { pollId: 'f560cf40-737d-417b-852b-24aab2b13dec' },
          authMode: 'apiKey',
        })
        setResult(JSON.stringify(response, null, 2))
      } catch (err) {
        setResult('Error: ' + JSON.stringify(err, null, 2))
      }
    }
    testConnection()
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Amplify Connection Test</h1>
      <pre>{result}</pre>
    </div>
  )
}

export default App