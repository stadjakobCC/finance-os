import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

// ── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'Food & Beverages',
  'Going Out & Party',
  'Fitness & Health',
  'Car',
  'Clothing',
  'Memberships',
  'Others',
  'Vacation',
]

const INCOME_CATEGORIES = ['Salary', 'Pocket Money', 'Gifts', 'Side Income']

const EXPENSE_TYPES = ['Essential', 'Useless']
const MAX_AMOUNT = 999_999_999
const MAX_DESC   = 200

const SHORT_CAT = {
  'Food & Beverages':  'Food',
  'Going Out & Party': 'Going Out',
  'Fitness & Health':  'Health',
  'Car':               'Car',
  'Clothing':          'Clothing',
  'Memberships':       'Members',
  'Salary':            'Salary',
  'Pocket Money':      'Pocket',
  'Gifts':             'Gifts',
  'Side Income':       'Side',
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount) {
  return '€' + Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1].slice(0, 3)} ${parseInt(d)}, ${y}`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MonthlyOverview({ session, onNavigate, darkMode, toggleDark }) {
  const today   = new Date()
  const userId  = session.user.id
  const initial = session.user.email.charAt(0).toUpperCase()

  // Month state
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  // Data
  const [expenses,     setExpenses]     = useState([])
  const [income,       setIncome]       = useState([])
  const [pastExpDescs, setPastExpDescs] = useState([])
  const [pastIncDescs, setPastIncDescs] = useState([])
  const [dataLoading,  setDataLoading]  = useState(false)

  // Expense form
  const [expForm, setExpForm] = useState({
    amount: '', category: EXPENSE_CATEGORIES[0], type: 'Essential',
    recurring: false, date: today.toISOString().split('T')[0], description: '',
  })

  // Income form
  const [incForm, setIncForm] = useState({
    amount: '', category: INCOME_CATEGORIES[0], recurring: false,
    date: today.toISOString().split('T')[0], description: '',
  })

  const [expStatus, setExpStatus] = useState(null)
  const [incStatus, setIncStatus] = useState(null)
  const [expError,  setExpError]  = useState(null)
  const [incError,  setIncError]  = useState(null)
  const [modal,     setModal]     = useState(null) // 'income' | 'expense' | null
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Date range for current month view
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const monthEnd   = (() => {
    const d = new Date(year, month + 1, 0)
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  useEffect(() => { loadMonthData() }, [year, month])  // eslint-disable-line
  useEffect(() => { loadDescriptions() }, [])           // eslint-disable-line

  async function loadMonthData() {
    setDataLoading(true)
    await Promise.all([fetchExpenses(), fetchIncome()])
    setDataLoading(false)
  }

  async function fetchExpenses() {
    const [{ data: monthData, error: e1 }, { data: recurringData, error: e2 }] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', userId)
        .gte('date', monthStart).lte('date', monthEnd)
        .order('date', { ascending: false }),
      supabase.from('expenses').select('*').eq('user_id', userId)
        .eq('recurring', true).lt('date', monthStart)
        .order('date', { ascending: false }),
    ])
    if (e1) console.error('[fetchExpenses] month query error:', e1.code)
    if (e2) console.error('[fetchExpenses] recurring query error:', e2.code)
    if (monthData) {
      const seen = new Set(monthData.map(r => r.id))
      const extra = (recurringData || []).filter(r => !seen.has(r.id))
      const merged = [...monthData, ...extra].sort((a, b) => b.date.localeCompare(a.date))
      setExpenses(merged)
    }
  }

  async function fetchIncome() {
    const { data, error } = await supabase
      .from('income').select('*').eq('user_id', userId)
      .gte('date', monthStart).lte('date', monthEnd)
      .order('date', { ascending: false })
    if (error) console.error('[fetchIncome]', error.code)
    else setIncome(data)
  }

  async function loadDescriptions() {
    const [{ data: expData, error: e1 }, { data: incData, error: e2 }] = await Promise.all([
      supabase.from('expenses').select('description').eq('user_id', userId).not('description', 'is', null),
      supabase.from('income').select('description').eq('user_id', userId).not('description', 'is', null),
    ])
    if (e1) console.error('[loadDescriptions] expenses error:', e1.code)
    if (e2) console.error('[loadDescriptions] income error:', e2.code)
    if (expData) setPastExpDescs([...new Set(expData.map(r => r.description).filter(Boolean))])
    if (incData) setPastIncDescs([...new Set(incData.map(r => r.description).filter(Boolean))])
  }

  async function handleAddExpense(e) {
    e.preventDefault()
    setExpError(null)
    const amount = parseFloat(expForm.amount)
    if (!Number.isFinite(amount) || amount <= 0)  { setExpError('Enter a valid positive amount.'); return }
    if (amount > MAX_AMOUNT)                       { setExpError('Amount exceeds maximum allowed.'); return }
    if (!EXPENSE_CATEGORIES.includes(expForm.category)) { setExpError('Invalid category.'); return }
    if (!EXPENSE_TYPES.includes(expForm.type))     { setExpError('Invalid type.'); return }
    const description = expForm.description.trim().slice(0, MAX_DESC) || null
    setExpStatus('loading')
    const { error } = await supabase.from('expenses').insert({
      user_id: userId, amount, category: expForm.category, type: expForm.type,
      recurring: expForm.recurring, date: expForm.date, description,
    })
    if (error) {
      console.error('[handleAddExpense]', error.code)
      setExpStatus('error')
      setExpError('Could not save expense. Please try again.')
      setTimeout(() => setExpStatus(null), 3000)
    } else {
      setExpStatus('success')
      setExpForm(f => ({ ...f, amount: '', recurring: false, description: '' }))
      fetchExpenses()
      loadDescriptions()
      setTimeout(() => { setExpStatus(null); setExpError(null); setModal(null) }, 1200)
    }
  }

  async function handleAddIncome(e) {
    e.preventDefault()
    setIncError(null)
    const amount = parseFloat(incForm.amount)
    if (!Number.isFinite(amount) || amount <= 0)  { setIncError('Enter a valid positive amount.'); return }
    if (amount > MAX_AMOUNT)                       { setIncError('Amount exceeds maximum allowed.'); return }
    if (!INCOME_CATEGORIES.includes(incForm.category)) { setIncError('Invalid category.'); return }
    const description = incForm.description.trim().slice(0, MAX_DESC) || null
    setIncStatus('loading')
    const { error } = await supabase.from('income').insert({
      user_id: userId, amount, category: incForm.category,
      recurring: incForm.recurring, date: incForm.date, description,
    })
    if (error) {
      console.error('[handleAddIncome]', error.code)
      setIncStatus('error')
      setIncError('Could not save income. Please try again.')
      setTimeout(() => setIncStatus(null), 3000)
    } else {
      setIncStatus('success')
      setIncForm(f => ({ ...f, amount: '', description: '' }))
      fetchIncome()
      loadDescriptions()
      setTimeout(() => { setIncStatus(null); setIncError(null); setModal(null) }, 1200)
    }
  }

  async function handleDelete(tx) {
    const table = tx.kind === 'expense' ? 'expenses' : 'income'
    const { error } = await supabase.from(table).delete().eq('id', tx.id).eq('user_id', userId)
    if (error) {
      console.error('[handleDelete] error:', error.code)
    } else {
      if (tx.kind === 'expense') setExpenses(prev => prev.filter(e => e.id !== tx.id))
      else setIncome(prev => prev.filter(i => i.id !== tx.id))
    }
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth())) return
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  // ── Computed values ──────────────────────────────────────────────────────
  const totalIncome   = useMemo(() => income.reduce((s, i) => s + i.amount, 0), [income])
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])
  const balance       = totalIncome - totalExpenses

  const categoryBreakdown = useMemo(() => {
    const map = {}
    for (const exp of expenses) map[exp.category] = (map[exp.category] || 0) + exp.amount
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [expenses])

  const typeBreakdown = useMemo(() => ({
    essential: expenses.filter(e => e.type === 'Essential').reduce((s, e) => s + e.amount, 0),
    useless:   expenses.filter(e => e.type === 'Useless').reduce((s, e) => s + e.amount, 0),
  }), [expenses])

  const transactions = useMemo(() => {
    const exps = expenses.map(e => ({ ...e, kind: 'expense' }))
    const incs  = income.map(i  => ({ ...i, kind: 'income'  }))
    return [...exps, ...incs].sort((a, b) => b.date.localeCompare(a.date))
  }, [expenses, income])

  // Donut chart (r=80, circumference=2π×80≈502.4)
  const circumference = 502.4
  const essentialPct  = totalExpenses > 0 ? typeBreakdown.essential / totalExpenses : 0
  const dashOffset    = circumference * (1 - essentialPct)

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-surface">

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed left-0 top-0 h-full z-50 flex flex-col p-4 bg-slate-50/70 backdrop-blur-xl w-64 border-r border-slate-200/50 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="mb-8 px-4 py-2">
          <button onClick={() => onNavigate('dashboard')} className="text-left hover:opacity-75 transition-opacity">
            <h1 className="text-lg font-bold tracking-tighter text-slate-900">FinanceOS</h1>
            <p className="text-[10px] font-medium tracking-widest text-on-surface-variant uppercase mt-0.5">Premium Member</p>
          </button>
        </div>
        <nav className="flex-1 space-y-1">
          <a onClick={() => { setSidebarOpen(false); onNavigate('dashboard') }} className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl">
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-blue-600 bg-white/50 rounded-xl shadow-sm font-sans text-sm font-medium tracking-tight cursor-pointer">
            <span className="material-symbols-outlined">calendar_month</span>
            <span>Overview</span>
          </a>
          <a onClick={() => { setSidebarOpen(false); onNavigate('portfolio') }} className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl">
            <span className="material-symbols-outlined">account_balance_wallet</span>
            <span>Portfolio</span>
          </a>
          <a onClick={() => { setSidebarOpen(false); onNavigate('savings') }} className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl">
            <span className="material-symbols-outlined">savings</span>
            <span>Savings</span>
          </a>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200/50">
          <div className="mt-4 flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm shrink-0">
              {initial}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-on-surface truncate">{session.user.email.split('@')[0]}</span>
              <button onClick={() => supabase.auth.signOut()} className="text-[10px] text-on-surface-variant hover:text-tertiary transition-colors text-left">Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 ml-0 md:ml-64 min-h-screen flex flex-col">

        {/* ── Header ── */}
        <header className="flex justify-between items-center w-full px-4 md:px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-30 border-b border-outline-variant/20">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              className="md:hidden p-2 -ml-2 text-on-surface-variant hover:opacity-70 transition-opacity"
              onClick={() => setSidebarOpen(s => !s)}
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex items-center gap-3 text-on-surface">
              <button className="p-2 hover:bg-surface-container transition-colors rounded-xl" onClick={prevMonth}>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_left</span>
              </button>
              <h2 className="text-lg md:text-2xl font-extrabold tracking-tight text-on-surface">{MONTH_NAMES[month]} {year}</h2>
              <button
                className="p-2 hover:bg-surface-container transition-colors rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={nextMonth}
                disabled={isCurrentMonth}
              >
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={toggleDark}
              className="text-on-surface-variant hover:opacity-70 transition-opacity"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="material-symbols-outlined">{darkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </div>
        </header>

        <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-8 md:space-y-12 w-full">

          {/* ── Page Heading ── */}
          <section className="flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">{MONTH_NAMES[month]} Overview</h1>
              <p className="text-on-surface-variant/70 font-medium">Monthly financial curation &amp; health report.</p>
            </div>
          </section>

          {/* ── Summary Cards ── */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Net Balance — large */}
            <div className="md:col-span-2 bg-surface-container-lowest p-8 rounded-[2rem] flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant/60">Net Monthly Balance</span>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className={`text-5xl font-extrabold tracking-tighter ${balance >= 0 ? 'text-on-surface' : 'text-tertiary'}`}>
                    {balance >= 0 ? '' : '- '}{fmt(Math.abs(balance))}
                  </span>
                </div>
              </div>
              <div className="h-16 w-full whisper-graph mt-4 rounded-xl overflow-hidden relative">
                <div className="absolute inset-0 flex items-end">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                    <path d="M0,40 Q15,10 30,25 T60,15 T100,30 V40 H0 Z" fill="#0058bc" fillOpacity="0.1" stroke="#0058bc" strokeWidth="0.5" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Income */}
            <div className="bg-surface-container-low p-6 rounded-[2rem] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant/60">Total Income</span>
                  <h2 className="text-3xl font-bold tracking-tight text-on-surface mt-1">{fmt(totalIncome)}</h2>
                </div>
                <button
                  onClick={() => setModal('income')}
                  className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center hover:bg-secondary/20 transition-colors"
                  title="Record Income"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <span className="material-symbols-outlined text-secondary">arrow_upward</span>
                <span className="text-xs font-medium text-on-surface-variant">{income.length} sources</span>
              </div>
            </div>
            {/* Expenses */}
            <div className="bg-surface-container-low p-6 rounded-[2rem] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant/60">Total Expenses</span>
                  <h2 className="text-3xl font-bold tracking-tight text-tertiary mt-1">{fmt(totalExpenses)}</h2>
                </div>
                <button
                  onClick={() => setModal('expense')}
                  className="w-8 h-8 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center hover:bg-tertiary/20 transition-colors"
                  title="Record Expense"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <span className="material-symbols-outlined text-tertiary">arrow_downward</span>
                <span className="text-xs font-medium text-on-surface-variant">{expenses.length} transactions</span>
              </div>
            </div>
          </section>

          {/* ── Transaction Hub ── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">

            {/* Financial Ledger */}
            <div className="lg:col-span-2 space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight text-on-surface">Financial Ledger</h3>
                <div className="flex gap-2">
                  <span className="text-xs font-bold text-on-surface-variant border border-outline-variant/30 px-3 py-1.5 rounded-lg bg-surface-container-lowest">
                    {transactions.length} entries
                  </span>
                </div>
              </div>

              {dataLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-3 text-center">
                  <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: '40px' }}>event_note</span>
                  <p className="text-sm font-bold text-on-surface-variant">No entries for {MONTH_NAMES[month]} {year}</p>
                  <p className="text-xs text-on-surface-variant/60">Use the + buttons above to record your first transaction</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map(tx => (
                    <div key={`${tx.kind}-${tx.id}`} className="flex items-center justify-between p-5 bg-surface-container-lowest rounded-2xl hover:scale-[1.01] transition-transform cursor-pointer group border border-outline-variant/5">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tx.kind === 'income' ? 'bg-secondary-container/20 text-secondary' : 'bg-surface-container text-on-surface-variant'}`}>
                          <span className="material-symbols-outlined">
                            {tx.kind === 'income' ? 'work' : 'shopping_bag'}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{tx.description || tx.category}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {tx.recurring && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant flex items-center gap-1">
                                <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>sync</span> RECURRING
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tx.kind === 'income' ? 'bg-secondary-container/20 text-on-secondary-container' : tx.type === 'Essential' ? 'bg-secondary-container/20 text-on-secondary-container' : 'bg-tertiary-container/10 text-tertiary'}`}>
                              {tx.kind === 'income' ? 'INCOME' : tx.type?.toUpperCase() || 'EXPENSE'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`font-bold ${tx.kind === 'income' ? 'text-secondary' : 'text-tertiary'}`}>
                            {tx.kind === 'income' ? '+' : '-'}{fmt(tx.amount)}
                          </p>
                          <p className="text-[10px] font-medium text-on-surface-variant/50">{fmtDate(tx.date)}</p>
                        </div>
                        <button
                          onClick={() => handleDelete(tx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-tertiary p-1 rounded-lg"
                          title="Delete record"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Curation & Entry Column */}
            <div className="space-y-8">

              {/* Category Breakdown */}
              <div className="bg-surface-container-lowest p-8 rounded-[2rem] space-y-6 shadow-sm">
                <h3 className="text-lg font-bold tracking-tight text-on-surface">Category Breakdown</h3>
                {categoryBreakdown.length > 0 ? (
                  <div className="space-y-5">
                    {categoryBreakdown.map(([cat, amt]) => (
                      <div key={cat} className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                          <span className="text-on-surface">{cat}</span>
                          <span className="text-on-surface-variant">{totalExpenses > 0 ? `${((amt / totalExpenses) * 100).toFixed(0)}%` : '0%'}</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${((amt / totalExpenses) * 100).toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/40 font-semibold">No expenses this month.</p>
                )}
              </div>

              {/* Value Intent Ratio */}
              <div className="bg-surface-container-low p-8 rounded-[2rem] flex flex-col items-center space-y-6">
                <h3 className="text-lg font-bold tracking-tight text-on-surface self-start">Value Intent Ratio</h3>
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" fill="transparent" r="68" stroke="#eeedf3" strokeWidth="8" />
                    <circle
                      cx="80" cy="80" fill="transparent" r="68"
                      stroke="#0058bc"
                      strokeDasharray={`${2 * Math.PI * 68}`}
                      strokeDashoffset={`${2 * Math.PI * 68 * (1 - essentialPct)}`}
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold tracking-tighter">
                      {totalExpenses > 0 ? `${(essentialPct * 100).toFixed(0)}%` : '—'}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Essential</span>
                  </div>
                </div>
                <div className="w-full space-y-3">
                  <div className="flex justify-between items-center bg-surface-container-lowest px-4 py-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-primary"></span>
                      <span className="text-sm font-semibold">Essential</span>
                    </div>
                    <span className="text-sm font-bold">{fmt(typeBreakdown.essential)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-surface-container-lowest px-4 py-3 rounded-xl opacity-60">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-surface-container-highest"></span>
                      <span className="text-sm font-semibold">Optional</span>
                    </div>
                    <span className="text-sm font-bold">{fmt(typeBreakdown.useless)}</span>
                  </div>
                </div>
              </div>

            </div>
          </section>

        </div>

        {/* ── Modal ── */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setModal(null)}>
            <div className="w-full max-w-md bg-surface-container-lowest rounded-[2rem] p-8 shadow-xl border border-outline-variant/10 space-y-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight text-on-surface">
                  {modal === 'income' ? 'Record Income' : 'Record Expense'}
                </h3>
                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>

              {modal === 'income' ? (
                <form onSubmit={handleAddIncome} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Amount (€)</label>
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 text-xl font-bold focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/20"
                      placeholder="0.00" step="0.01" type="number" min="0.01"
                      value={incForm.amount}
                      onChange={e => setIncForm(f => ({ ...f, amount: e.target.value }))}
                      required autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Category</label>
                    <select
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-5 text-sm focus:ring-1 focus:ring-primary/20"
                      value={incForm.category}
                      onChange={e => setIncForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {INCOME_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => setIncForm(f => ({ ...f, recurring: !f.recurring }))}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-colors ${incForm.recurring ? 'bg-primary/10 border border-primary/20' : 'bg-surface-container-low hover:bg-surface-container'}`}
                    >
                      <span className={`material-symbols-outlined text-sm ${incForm.recurring ? 'text-primary' : 'text-on-surface-variant'}`}>sync</span>
                      <span className={`text-xs font-bold ${incForm.recurring ? 'text-primary' : 'text-on-surface-variant'}`}>Recurring</span>
                    </div>
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20"
                      type="date" value={incForm.date}
                      onChange={e => setIncForm(f => ({ ...f, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Description</label>
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-5 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/20"
                      placeholder="Source details..." type="text" maxLength={MAX_DESC}
                      value={incForm.description}
                      onChange={e => setIncForm(f => ({ ...f, description: e.target.value }))}
                      list="inc-desc-list" autoComplete="off"
                    />
                    <datalist id="inc-desc-list">
                      {pastIncDescs.map(d => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                  {incError && <p className="text-xs text-tertiary font-medium px-1">{incError}</p>}
                  <button
                    className="w-full bg-secondary text-on-secondary py-4 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all mt-2 disabled:opacity-50"
                    type="submit" disabled={incStatus === 'loading'}
                  >
                    {incStatus === 'loading' ? 'Processing...' : incStatus === 'success' ? '✓ Income Recorded' : 'Record Income'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Amount (€)</label>
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl py-4 px-5 text-xl font-bold focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/20"
                      placeholder="0.00" step="0.01" type="number" min="0.01"
                      value={expForm.amount}
                      onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                      required autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Category</label>
                    <select
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-5 text-sm focus:ring-1 focus:ring-primary/20"
                      value={expForm.category}
                      onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl border transition-colors ${expForm.type === 'Essential' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline'}`}
                      type="button" onClick={() => setExpForm(f => ({ ...f, type: 'Essential' }))}
                    >Essential</button>
                    <button
                      className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl border transition-colors ${expForm.type === 'Useless' ? 'border-tertiary bg-tertiary/5 text-tertiary' : 'border-outline-variant/30 text-on-surface-variant hover:border-outline'}`}
                      type="button" onClick={() => setExpForm(f => ({ ...f, type: 'Useless' }))}
                    >Optional</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => setExpForm(f => ({ ...f, recurring: !f.recurring }))}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-colors ${expForm.recurring ? 'bg-primary/10 border border-primary/20' : 'bg-surface-container-low hover:bg-surface-container'}`}
                    >
                      <span className={`material-symbols-outlined text-sm ${expForm.recurring ? 'text-primary' : 'text-on-surface-variant'}`}>sync</span>
                      <span className={`text-xs font-bold ${expForm.recurring ? 'text-primary' : 'text-on-surface-variant'}`}>Recurring</span>
                    </div>
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20"
                      type="date" value={expForm.date}
                      onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Description</label>
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-5 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/20"
                      placeholder="Transaction details..." type="text" maxLength={MAX_DESC}
                      value={expForm.description}
                      onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))}
                      list="exp-desc-list" autoComplete="off"
                    />
                    <datalist id="exp-desc-list">
                      {pastExpDescs.map(d => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                  {expError && <p className="text-xs text-tertiary font-medium px-1">{expError}</p>}
                  <button
                    className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all mt-2 disabled:opacity-50"
                    type="submit" disabled={expStatus === 'loading'}
                  >
                    {expStatus === 'loading' ? 'Processing...' : expStatus === 'success' ? '✓ Expense Recorded' : 'Record Expense'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="py-8 px-8 flex items-center justify-center border-t border-outline-variant/20 mt-auto bg-surface">
          <p className="text-[10px] text-on-surface-variant/50 font-medium">
            Built by Jakob ·{' '}
            <a href="https://github.com/stadjakobCC" target="_blank" rel="noopener noreferrer" className="hover:text-on-surface-variant transition-colors">GitHub</a>
          </p>
        </footer>

      </main>
    </div>
  )
}
