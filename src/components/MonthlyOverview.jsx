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
]

const INCOME_CATEGORIES = ['Salary', 'Pocket Money', 'Gifts', 'Side Income']

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
  return '€ ' + Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function fmtDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1].slice(0, 3)} ${parseInt(d)}`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MonthlyOverview({ session, onNavigate }) {
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
    console.log('[fetchExpenses] querying expenses for user_id:', userId, 'range:', monthStart, '→', monthEnd)
    // Fetch this month's expenses + all recurring expenses (they appear in every month)
    const [{ data: monthData, error: e1 }, { data: recurringData, error: e2 }] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', userId)
        .gte('date', monthStart).lte('date', monthEnd)
        .order('date', { ascending: false }),
      supabase.from('expenses').select('*').eq('user_id', userId)
        .eq('recurring', true).lt('date', monthStart)
        .order('date', { ascending: false }),
    ])
    if (e1) console.error('[fetchExpenses] month query error:', e1)
    if (e2) console.error('[fetchExpenses] recurring query error:', e2)
    if (monthData) {
      // Merge: dedupe by id so recurring expenses already in this month aren't doubled
      const seen = new Set(monthData.map(r => r.id))
      const extra = (recurringData || []).filter(r => !seen.has(r.id))
      const merged = [...monthData, ...extra].sort((a, b) => b.date.localeCompare(a.date))
      console.log('[fetchExpenses] rows returned:', merged.length)
      setExpenses(merged)
    }
  }

  async function fetchIncome() {
    console.log('[fetchIncome] querying income for user_id:', userId, 'range:', monthStart, '→', monthEnd)
    const { data, error } = await supabase
      .from('income').select('*').eq('user_id', userId)
      .gte('date', monthStart).lte('date', monthEnd)
      .order('date', { ascending: false })
    if (error) console.error('[fetchIncome] error:', error)
    else { console.log('[fetchIncome] rows returned:', data.length); setIncome(data) }
  }

  async function loadDescriptions() {
    const [{ data: expData, error: e1 }, { data: incData, error: e2 }] = await Promise.all([
      supabase.from('expenses').select('description').eq('user_id', userId).not('description', 'is', null),
      supabase.from('income').select('description').eq('user_id', userId).not('description', 'is', null),
    ])
    if (e1) console.error('[loadDescriptions] expenses error:', e1)
    if (e2) console.error('[loadDescriptions] income error:', e2)
    if (expData) setPastExpDescs([...new Set(expData.map(r => r.description).filter(Boolean))])
    if (incData) setPastIncDescs([...new Set(incData.map(r => r.description).filter(Boolean))])
  }

  async function handleAddExpense(e) {
    e.preventDefault()
    setExpStatus('loading')
    const payload = {
      user_id:     userId,
      amount:      parseFloat(expForm.amount),
      category:    expForm.category,
      type:        expForm.type,
      recurring:   expForm.recurring,
      date:        expForm.date,
      description: expForm.description || null,
    }
    console.log('[handleAddExpense] inserting:', payload)
    const { error } = await supabase.from('expenses').insert(payload)
    if (error) {
      console.error('[handleAddExpense] error:', error)
      console.error('[handleAddExpense] error details:', error.details, '| hint:', error.hint, '| code:', error.code)
      setExpStatus('error')
      setTimeout(() => setExpStatus(null), 3000)
    } else {
      console.log('[handleAddExpense] success')
      setExpStatus('success')
      setExpForm(f => ({ ...f, amount: '', recurring: false, description: '' }))
      fetchExpenses()
      loadDescriptions()
      setTimeout(() => setExpStatus(null), 2500)
    }
  }

  async function handleAddIncome(e) {
    e.preventDefault()
    setIncStatus('loading')
    const payload = {
      user_id:     userId,
      amount:      parseFloat(incForm.amount),
      category:    incForm.category,
      recurring:   incForm.recurring,
      date:        incForm.date,
      description: incForm.description || null,
    }
    console.log('[handleAddIncome] inserting:', payload)
    const { error } = await supabase.from('income').insert(payload)
    if (error) {
      console.error('[handleAddIncome] error:', error)
      console.error('[handleAddIncome] error details:', error.details, '| hint:', error.hint, '| code:', error.code)
      setIncStatus('error')
      setTimeout(() => setIncStatus(null), 3000)
    } else {
      console.log('[handleAddIncome] success')
      setIncStatus('success')
      setIncForm(f => ({ ...f, amount: '', description: '' }))
      fetchIncome()
      loadDescriptions()
      setTimeout(() => setIncStatus(null), 2500)
    }
  }

  async function handleDelete(tx) {
    const table = tx.kind === 'expense' ? 'expenses' : 'income'
    const { error } = await supabase.from(table).delete().eq('id', tx.id).eq('user_id', userId)
    if (error) {
      console.error('[handleDelete] error:', error)
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

  // Donut chart (r=80, circumference=2π×80≈502.4 — matches the HTML exactly)
  const circumference = 502.4
  const essentialPct  = totalExpenses > 0 ? typeBreakdown.essential / totalExpenses : 0
  const dashOffset    = circumference * (1 - essentialPct)

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">

      {/* ── SideNavBar Shell (exact from HTML) ── */}
      <aside className="fixed left-0 top-0 h-full flex flex-col py-8 bg-[#1c1b1b] w-64 z-50">
        <div className="px-8 mb-12">
          <h1 className="text-2xl font-serif italic text-[#f2ca50]">FinanceOS</h1>
          <p className="label-caps text-on-surface-variant opacity-60">Sovereign Curator</p>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          <a
            className="flex items-center gap-4 px-8 py-4 text-gray-500 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer"
            onClick={() => onNavigate('dashboard')}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="label-caps">Dashboard</span>
          </a>
          <a className="flex items-center gap-4 px-8 py-4 text-[#f2ca50] border-l-2 border-[#f2ca50] font-bold bg-[#2a2a2a]/50">
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="label-caps">Monthly Overview</span>
          </a>
          <a
            className="flex items-center gap-4 px-8 py-4 text-gray-500 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer"
            onClick={() => onNavigate('portfolio')}
          >
            <span className="material-symbols-outlined">account_balance_wallet</span>
            <span className="label-caps">Portfolio</span>
          </a>
          <a className="flex items-center gap-4 px-8 py-4 text-gray-500 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer" onClick={() => onNavigate('savings')}>
            <span className="material-symbols-outlined">savings</span>
            <span className="label-caps">Savings Goals</span>
          </a>
        </nav>
        <div className="mt-auto px-8 flex flex-col gap-4">
          <button
            className="bg-gradient-to-b from-[#f2ca50] to-[#d4af37] text-[#3c2f00] px-6 py-3 label-caps font-bold transition-transform duration-200 active:scale-95"
            onClick={() => supabase.auth.signOut()}
          >
            Sign Out
          </button>
          <div className="flex flex-col gap-1">
            <div className="label-caps text-gray-600 text-[0.6rem] py-1 truncate">{session.user.email}</div>
            <a className="flex items-center gap-4 py-2 text-gray-500 hover:text-gray-200 transition-colors" href="#">
              <span className="material-symbols-outlined">settings</span>
              <span className="label-caps">Settings</span>
            </a>
            <a className="flex items-center gap-4 py-2 text-gray-500 hover:text-gray-200 transition-colors" href="#">
              <span className="material-symbols-outlined">help</span>
              <span className="label-caps">Support</span>
            </a>
          </div>
        </div>
      </aside>

      {/* ── Main Content Canvas (exact from HTML) ── */}
      <main className="flex-1 ml-64 min-h-screen flex flex-col">

        {/* ── TopNavBar Shell ── */}
        <header className="flex justify-between items-center w-full px-12 py-8 bg-[#131313]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4 text-[#f2ca50]">
              <button className="p-2 hover:bg-[#2a2a2a] transition-colors" onClick={prevMonth}>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <h2 className="serif-italic text-3xl">{MONTH_NAMES[month]} {year}</h2>
              <button
                className="p-2 hover:bg-[#2a2a2a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={nextMonth}
                disabled={isCurrentMonth}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-gray-400 hover:text-[#f2ca50] transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="text-gray-400 hover:text-[#f2ca50] transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="w-10 h-10 bg-[#2a2a2a] flex items-center justify-center text-[#f2ca50] font-bold text-sm">
              {initial}
            </div>
          </div>
        </header>

        <div className="px-12 pb-24 space-y-12">

          {/* ── Summary Cards (exact from HTML) ── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-container-low p-8 relative overflow-hidden">
              <p className="label-caps text-on-surface-variant opacity-60 mb-2">Total Income</p>
              <h3 className="serif-italic text-4xl text-tertiary">{fmt(totalIncome)}</h3>
              <div className="absolute -right-4 -bottom-4 opacity-5 text-tertiary">
                <span className="material-symbols-outlined text-8xl">trending_up</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-8 relative overflow-hidden">
              <p className="label-caps text-on-surface-variant opacity-60 mb-2">Total Expenses</p>
              <h3 className="serif-italic text-4xl text-error">{fmt(totalExpenses)}</h3>
              <div className="absolute -right-4 -bottom-4 opacity-5 text-error">
                <span className="material-symbols-outlined text-8xl">trending_down</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-8 relative overflow-hidden border-b-2 border-[#f2ca50]">
              <p className="label-caps text-on-surface-variant opacity-60 mb-2">Net Balance</p>
              <h3 className={`serif-italic text-4xl ${balance >= 0 ? 'text-[#f2ca50]' : 'text-error'}`}>
                {balance >= 0 ? '' : '- '}{fmt(Math.abs(balance))}
              </h3>
              <div className="absolute -right-4 -bottom-4 opacity-5 text-[#f2ca50]">
                <span className="material-symbols-outlined text-8xl">account_balance</span>
              </div>
            </div>
          </section>

          {/* ── Forms Section ── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            {/* Add Income */}
            <div className="bg-surface-container-low p-10 space-y-8">
              <h4 className="serif-italic text-2xl border-b border-outline-variant pb-4">Income</h4>
              <form onSubmit={handleAddIncome} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="label-caps">Amount (€)</label>
                    <input
                      className="w-full bg-transparent border-b border-outline focus:border-[#f2ca50] focus:ring-0 text-xl py-2 outline-none"
                      placeholder="0.00" step="0.01" type="number" min="0.01"
                      value={incForm.amount}
                      onChange={e => setIncForm(f => ({ ...f, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label-caps">Origin</label>
                    <select
                      className="w-full bg-transparent border-b border-outline focus:border-[#f2ca50] focus:ring-0 text-sm py-2 appearance-none"
                      value={incForm.category}
                      onChange={e => setIncForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {INCOME_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-[#2a2a2a]">{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="label-caps">Recurring Status</label>
                    <div className="flex items-center gap-4 py-2">
                      <span className="label-caps opacity-60">No</span>
                      <div
                        className="w-12 h-6 bg-[#2a2a2a] rounded-full relative cursor-pointer group"
                        onClick={() => setIncForm(f => ({ ...f, recurring: !f.recurring }))}
                      >
                        <div className={`absolute top-1 w-4 h-4 transition-all duration-200 ${incForm.recurring ? 'left-7 bg-[#f2ca50]' : 'left-1 bg-[#99907c]'}`} />
                      </div>
                      <span className="label-caps opacity-60">Yes</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="label-caps">Date</label>
                    <input
                      className="w-full bg-transparent border-b border-outline focus:border-[#f2ca50] focus:ring-0 text-sm py-2"
                      type="date"
                      value={incForm.date}
                      onChange={e => setIncForm(f => ({ ...f, date: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label-caps">Description</label>
                  <input
                    className="w-full bg-transparent border-b border-outline focus:border-[#f2ca50] focus:ring-0 text-sm py-2"
                    placeholder="Source details..." type="text"
                    value={incForm.description}
                    onChange={e => setIncForm(f => ({ ...f, description: e.target.value }))}
                    list="inc-desc-list" autoComplete="off"
                  />
                  <datalist id="inc-desc-list">
                    {pastIncDescs.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <button
                  className="w-full py-4 bg-[#2a2a2a] hover:bg-[#353534] transition-colors text-[#b6d5cb] label-caps border border-[#b6d5cb]/20 disabled:opacity-50"
                  type="submit" disabled={incStatus === 'loading'}
                >
                  {incStatus === 'loading' ? 'Processing...'
                    : incStatus === 'success' ? '✓ Income Recorded'
                    : incStatus === 'error'   ? 'Error — Try Again'
                    : 'Confirm Influx'}
                </button>
              </form>
            </div>

            {/* Add Expense */}
            <div className="bg-surface-container-low p-10 space-y-8">
              <h4 className="serif-italic text-2xl border-b border-outline-variant pb-4">Expenses</h4>
              <form onSubmit={handleAddExpense} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="label-caps">Amount (€)</label>
                    <input
                      className="w-full bg-transparent border-b border-outline focus:border-[#f2ca50] focus:ring-0 text-xl py-2 outline-none"
                      placeholder="0.00" step="0.01" type="number" min="0.01"
                      value={expForm.amount}
                      onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label-caps">Category</label>
                    <select
                      className="w-full bg-transparent border-b border-outline focus:border-[#f2ca50] focus:ring-0 text-sm py-2 appearance-none"
                      value={expForm.category}
                      onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-[#2a2a2a]">{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="label-caps">Classification</label>
                    <div className="flex gap-2">
                      <button
                        className={`flex-1 py-2 border label-caps ${expForm.type === 'Essential' ? 'border-[#f2ca50] text-[#f2ca50] bg-[#f2ca50]/10' : 'border-outline-variant text-on-surface-variant hover:border-outline transition-colors'}`}
                        type="button"
                        onClick={() => setExpForm(f => ({ ...f, type: 'Essential' }))}
                      >
                        Essential
                      </button>
                      <button
                        className={`flex-1 py-2 border label-caps ${expForm.type === 'Useless' ? 'border-[#ffb4ab] text-[#ffb4ab] bg-[#ffb4ab]/10' : 'border-outline-variant text-on-surface-variant hover:border-outline transition-colors'}`}
                        type="button"
                        onClick={() => setExpForm(f => ({ ...f, type: 'Useless' }))}
                      >
                        Useless
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="label-caps">Date</label>
                    <input
                      className="w-full bg-transparent border-b border-outline focus:border-[#f2ca50] focus:ring-0 text-sm py-2"
                      type="date"
                      value={expForm.date}
                      onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="label-caps">Recurring Status</label>
                    <div className="flex items-center gap-4 py-2">
                      <span className="label-caps opacity-60">No</span>
                      <div
                        className="w-12 h-6 bg-[#2a2a2a] rounded-full relative cursor-pointer"
                        onClick={() => setExpForm(f => ({ ...f, recurring: !f.recurring }))}
                      >
                        <div className={`absolute top-1 w-4 h-4 transition-all duration-200 ${expForm.recurring ? 'left-7 bg-[#f2ca50]' : 'left-1 bg-[#99907c]'}`} />
                      </div>
                      <span className="label-caps opacity-60">Yes</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label-caps">Description</label>
                  <input
                    className="w-full bg-transparent border-b border-outline focus:border-[#f2ca50] focus:ring-0 text-sm py-2"
                    placeholder="Transaction details..." type="text"
                    value={expForm.description}
                    onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))}
                    list="exp-desc-list" autoComplete="off"
                  />
                  <datalist id="exp-desc-list">
                    {pastExpDescs.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                <button
                  className="w-full py-4 bg-[#2a2a2a] hover:bg-[#353534] transition-colors text-[#ffb4ab] label-caps border border-[#ffb4ab]/20 disabled:opacity-50"
                  type="submit" disabled={expStatus === 'loading'}
                >
                  {expStatus === 'loading' ? 'Processing...'
                    : expStatus === 'success' ? '✓ Expense Recorded'
                    : expStatus === 'error'   ? 'Error — Try Again'
                    : 'Authorize Expense'}
                </button>
              </form>
            </div>
          </section>

          {/* ── Analysis Section (exact from HTML) ── */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-12">

            {/* Category Distribution */}
            <div className="xl:col-span-2 bg-surface-container-low p-10 space-y-10">
              <h4 className="serif-italic text-2xl">Category Distribution</h4>
              {categoryBreakdown.length > 0 ? (
                <div className="space-y-8">
                  {categoryBreakdown.map(([cat, amt]) => (
                    <div key={cat} className="space-y-2">
                      <div className="flex justify-between label-caps">
                        <span>{cat}</span>
                        <span>{fmt(amt)}</span>
                      </div>
                      <div className="h-1 bg-[#2a2a2a] w-full overflow-hidden">
                        <div
                          className="h-full bg-[#f2ca50]"
                          style={{ width: `${((amt / totalExpenses) * 100).toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="label-caps text-on-surface-variant opacity-40">No expenses recorded this month.</p>
              )}
            </div>

            {/* Value Intent Ratio (exact SVG from HTML) */}
            <div className="bg-surface-container-low p-10 flex flex-col items-center justify-center space-y-8">
              <h4 className="serif-italic text-2xl text-center">Value Intent Ratio</h4>
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="96" cy="96" fill="transparent" r="80" stroke="#2a2a2a" strokeWidth="4" />
                  <circle
                    cx="96" cy="96" fill="transparent" r="80"
                    stroke="#f2ca50"
                    strokeDasharray="502.4"
                    strokeDashoffset={dashOffset}
                    strokeWidth="4"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="serif-italic text-3xl">
                    {totalExpenses > 0 ? `${(essentialPct * 100).toFixed(0)}%` : '—'}
                  </span>
                  <span className="label-caps text-[0.6rem] opacity-50">Essential</span>
                </div>
              </div>
              <div className="w-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-[#f2ca50]" />
                    <span className="label-caps">Essential</span>
                  </div>
                  <span className="label-caps">{fmt(typeBreakdown.essential)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-[#2a2a2a]" />
                    <span className="label-caps">Useless</span>
                  </div>
                  <span className="label-caps">{fmt(typeBreakdown.useless)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Recent Transactions (exact from HTML) ── */}
          <section className="space-y-6">
            <div className="flex justify-between items-end border-b border-outline-variant pb-4">
              <h4 className="serif-italic text-3xl">Ledger Records</h4>
              <span className="label-caps text-[#f2ca50]">{transactions.length} entries</span>
            </div>

            {dataLoading ? (
              <p className="label-caps text-on-surface-variant opacity-40 py-8">Loading...</p>
            ) : transactions.length === 0 ? (
              <p className="label-caps text-on-surface-variant opacity-40 py-8">
                No records for {MONTH_NAMES[month]} {year}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="label-caps text-on-surface-variant border-b border-outline-variant/30" style={{ opacity: 0.4 }}>
                      <th className="py-4 font-normal">Date</th>
                      <th className="py-4 font-normal">Description</th>
                      <th className="py-4 font-normal text-center">Category</th>
                      <th className="py-4 font-normal text-right">Amount</th>
                      <th className="py-4 font-normal w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {transactions.map(tx => (
                      <tr key={`${tx.kind}-${tx.id}`} className="group hover:bg-surface-container-low transition-colors">
                        <td className="py-6 label-caps opacity-60">{fmtDate(tx.date)}</td>
                        <td className="py-6 serif-italic text-lg">
                          {tx.description || tx.category}
                          {tx.recurring && (
                            <span className="ml-2 text-[10px] uppercase tracking-widest text-[#f2ca50] opacity-70 not-italic font-sans">recurring</span>
                          )}
                        </td>
                        <td className="py-6 text-center">
                          <span className="px-3 py-1 bg-[#2a2a2a] text-[10px] uppercase tracking-widest text-on-surface-variant">
                            {SHORT_CAT[tx.category] || tx.category}
                          </span>
                        </td>
                        <td className={`py-6 text-right font-medium ${tx.kind === 'income' ? 'text-[#b6d5cb]' : 'text-[#ffb4ab]'}`}>
                          {tx.kind === 'income' ? '+ ' : '- '}{fmt(tx.amount)}
                        </td>
                        <td className="py-6 w-8">
                          <button
                            onClick={() => handleDelete(tx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-[#ffb4ab] p-1"
                            title="Delete record"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* ── Footer Shell (exact from HTML) ── */}
        <footer className="flex flex-col items-center gap-4 w-full py-12 px-8 mt-auto border-t border-[#e5e2e1]/15 bg-[#131313]">
          <div className="text-sm font-serif italic text-[#f2ca50]">FinanceOS</div>
          <div className="flex gap-8">
            <a className="label-caps text-gray-600 hover:text-white transition-colors" href="#">Terms</a>
            <a className="label-caps text-gray-600 hover:text-white transition-colors" href="#">Privacy</a>
            <a className="label-caps text-gray-600 hover:text-white transition-colors" href="#">Compliance</a>
            <a className="label-caps text-gray-600 hover:text-white transition-colors" href="#">Contact</a>
          </div>
          <p className="font-sans text-[10px] uppercase tracking-widest text-gray-600">© FinanceOS. All rights reserved.</p>
        </footer>

      </main>
    </div>
  )
}
