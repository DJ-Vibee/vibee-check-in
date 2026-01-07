import React from 'react'
import Dashboard from './components/Dashboard'
import { SettingsProvider } from './utils/SettingsContext'

function App() {
  return (
    <SettingsProvider>
      <Dashboard />
    </SettingsProvider>
  )
}

export default App
