import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { PriceProvider } from './priceContext'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import MonthlyOverview from './components/MonthlyOverview'
import Portfolio from './components/Portfolio'
import SavingsGoals from './components/SavingsGoals'

function App() {
  const [session, setSession] = useState(undefined)
  const [page,    setPage]    = useState('dashboard')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const toggleDark = () => setDarkMode(d => !d)

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="font-sans uppercase tracking-widest text-[10px] text-on-surface-variant/40">Loading...</p>
      </div>
    )
  }

  if (!session) return <Auth darkMode={darkMode} toggleDark={toggleDark} />

  const pageProps = { session, onNavigate: setPage, darkMode, toggleDark }

  return (
    <PriceProvider>
      {page === 'monthly'   ? <MonthlyOverview {...pageProps} /> :
       page === 'portfolio' ? <Portfolio        {...pageProps} /> :
       page === 'savings'   ? <SavingsGoals    {...pageProps} /> :
                              <Dashboard        {...pageProps} />}
    </PriceProvider>
  )
}

export default App
