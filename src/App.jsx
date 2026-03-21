import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import MonthlyOverview from './components/MonthlyOverview'
import Portfolio from './components/Portfolio'
import SavingsGoals from './components/SavingsGoals'

function App() {
  const [session, setSession] = useState(undefined)
  const [page,    setPage]    = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <p className="font-sans uppercase tracking-widest text-[10px] text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!session) return <Auth />

  if (page === 'monthly')   return <MonthlyOverview session={session} onNavigate={setPage} />
  if (page === 'portfolio') return <Portfolio        session={session} onNavigate={setPage} />
  if (page === 'savings')   return <SavingsGoals    session={session} onNavigate={setPage} />
  return                           <Dashboard        session={session} onNavigate={setPage} />
}

export default App
