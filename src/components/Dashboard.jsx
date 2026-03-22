import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const CAT_ICONS = {
  'Food & Beverages':  'restaurant',
  'Going Out & Party': 'celebration',
  'Fitness & Health':  'fitness_center',
  'Car':               'directions_car',
  'Clothing':          'shopping_bag',
  'Memberships':       'card_membership',
  'Others':            'more_horiz',
  'Vacation':          'beach_access',
  'Salary':            'payments',
  'Pocket Money':      'savings',
  'Gifts':             'redeem',
  'Side Income':       'trending_up',
}

function fmt(amount) {
  return '€ ' + Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function fmtShort(amount) {
  return '€ ' + Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  })
}

function fmtTxDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1].slice(0, 3).toUpperCase()} ${parseInt(d)}`
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Dashboard({ session, onNavigate, darkMode, toggleDark }) {
  const today  = new Date()
  const userId = session.user.id
  const initial = session.user.email.charAt(0).toUpperCase()

  const [allExpenses, setAllExpenses] = useState([])
  const [allIncome,   setAllIncome]   = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: expData }, { data: incData }] = await Promise.all([
        supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('income').select('*').eq('user_id', userId).order('date', { ascending: false }),
      ])
      if (expData) setAllExpenses(expData)
      if (incData) setAllIncome(incData)
      setLoading(false)
    }
    load()
  }, [userId])

  // ── Total Assets ────────────────────────────────────────────────────────
  const totalAssetsIncome   = useMemo(() => allIncome.reduce((s, r) => s + r.amount, 0), [allIncome])
  const totalAssetsExpenses = useMemo(() => allExpenses.reduce((s, r) => s + r.amount, 0), [allExpenses])
  const totalAssets         = totalAssetsIncome - totalAssetsExpenses

  // ── Last 5 transactions ──────────────────────────────────────────────────
  const recentTx = useMemo(() => {
    const exps = allExpenses.map(e => ({ ...e, kind: 'expense' }))
    const incs  = allIncome.map(i  => ({ ...i, kind: 'income'  }))
    return [...exps, ...incs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
  }, [allExpenses, allIncome])

  // ── Spending Trajectory (this month vs last month, by week) ─────────────
  const spendingChart = useMemo(() => {
    const cy = today.getFullYear()
    const cm = today.getMonth()
    const lm = cm === 0 ? 11 : cm - 1
    const ly = cm === 0 ? cy - 1 : cy

    function weekOf(dateStr) {
      const d = parseInt(dateStr.split('-')[2])
      if (d <= 7)  return 'Wk 1'
      if (d <= 14) return 'Wk 2'
      if (d <= 21) return 'Wk 3'
      return 'Wk 4'
    }

    function monthKey(dateStr) {
      const [y, m] = dateStr.split('-')
      return `${y}-${m}`
    }

    const thisKey = `${cy}-${String(cm + 1).padStart(2, '0')}`
    const lastKey = `${ly}-${String(lm + 1).padStart(2, '0')}`

    const weeks = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4']
    const thisMonth = Object.fromEntries(weeks.map(w => [w, 0]))
    const lastMonth = Object.fromEntries(weeks.map(w => [w, 0]))

    for (const e of allExpenses) {
      const k = monthKey(e.date)
      if (k === thisKey) thisMonth[weekOf(e.date)] += e.amount
      if (k === lastKey) lastMonth[weekOf(e.date)] += e.amount
    }

    return weeks.map(w => ({
      week: w,
      'This Month': Math.round(thisMonth[w]),
      'Last Month':  Math.round(lastMonth[w]),
    }))
  }, [allExpenses])

  // ── Essential vs Useless (all-time) ─────────────────────────────────────
  const typeBreakdown = useMemo(() => {
    const essential = allExpenses.filter(e => e.type === 'Essential').reduce((s, e) => s + e.amount, 0)
    const useless   = allExpenses.filter(e => e.type === 'Useless').reduce((s, e) => s + e.amount, 0)
    return { essential, useless }
  }, [allExpenses])

  const essentialPct = totalAssetsExpenses > 0
    ? Math.round((typeBreakdown.essential / totalAssetsExpenses) * 100)
    : 0

  const donutData = [
    { name: 'Essential', value: typeBreakdown.essential || 1 },
    { name: 'Useless',   value: typeBreakdown.useless   || 0 },
  ]

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-surface">

      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 h-full z-50 flex flex-col p-4 bg-slate-50/70 backdrop-blur-xl w-64 border-r border-slate-200/50">
        <div className="mb-8 px-4 py-2">
          <button onClick={() => onNavigate('dashboard')} className="text-left hover:opacity-75 transition-opacity">
            <h1 className="text-lg font-bold tracking-tighter text-slate-900">FinanceOS</h1>
            <p className="text-[10px] font-medium tracking-widest text-on-surface-variant uppercase mt-0.5">Premium Member</p>
          </button>
        </div>
        <nav className="flex-1 space-y-1">
          <a
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-3 px-4 py-3 text-blue-600 bg-white/50 rounded-xl shadow-sm font-sans text-sm font-medium tracking-tight transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a
            onClick={() => onNavigate('monthly')}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl"
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span>Overview</span>
          </a>
          <a
            onClick={() => onNavigate('portfolio')}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl"
          >
            <span className="material-symbols-outlined">account_balance_wallet</span>
            <span>Portfolio</span>
          </a>
          <a
            onClick={() => onNavigate('savings')}
            className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl"
          >
            <span className="material-symbols-outlined">savings</span>
            <span>Savings</span>
          </a>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200/50">
          <button
            onClick={() => onNavigate('monthly')}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Add Transaction
          </button>
          <div className="mt-6 flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm shrink-0">
              {initial}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-on-surface truncate">{session.user.email.split('@')[0]}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-[10px] text-on-surface-variant hover:text-tertiary transition-colors text-left"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ml-64 min-h-screen flex-1">

        {/* ── Header ── */}
        <header className="flex justify-end items-center w-full px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-30 border-b border-outline-variant/20">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDark}
              className="text-on-surface-variant hover:opacity-70 transition-opacity"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="material-symbols-outlined">{darkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="px-10 py-10 space-y-10 max-w-7xl mx-auto">

          {/* ── Hero: Total Assets ── */}
          <section className="grid grid-cols-12 gap-8 items-end">
            <div className="col-span-12 md:col-span-8">
              <div className="space-y-2">
                <span className="text-[11px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Current Net Balance</span>
                <div className="flex items-baseline gap-4">
                  <h2 className={`text-7xl font-extrabold tracking-tighter ${totalAssets < 0 ? 'text-tertiary' : 'text-on-surface'}`}>
                    {loading ? '—' : (totalAssets < 0 ? '-' : '') + fmt(totalAssets)}
                  </h2>
                </div>
                <div className="flex gap-10 mt-4">
                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Total Income</p>
                    <p className="text-lg font-bold text-secondary mt-0.5">{loading ? '—' : fmtShort(totalAssetsIncome)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Total Expenses</p>
                    <p className="text-lg font-bold text-tertiary mt-0.5">{loading ? '—' : '-' + fmtShort(totalAssetsExpenses)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Essential Ratio</p>
                    <p className="text-lg font-bold text-primary mt-0.5">{totalAssetsExpenses > 0 ? `${essentialPct}%` : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4 flex justify-end gap-3 pb-2">
              <button
                onClick={() => onNavigate('monthly')}
                className="px-6 py-2.5 bg-surface-container-lowest text-on-surface text-sm font-semibold rounded-full border border-outline-variant/20 hover:bg-surface-container transition-colors"
              >
                View Ledger
              </button>
              <button
                onClick={() => onNavigate('portfolio')}
                className="px-6 py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
              >
                Portfolio
              </button>
            </div>
          </section>

          {/* ── Bento Grid ── */}
          <div className="grid grid-cols-12 gap-8">

            {/* Spending Trajectory Chart */}
            <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-2xl p-8 space-y-6 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold tracking-tight">Spending Trajectory</h3>
                  <p className="text-xs text-on-surface-variant">Weekly comparison — current vs previous month</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{MONTH_NAMES[today.getMonth()].slice(0,3)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-outline-variant"></span>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      {MONTH_NAMES[today.getMonth() === 0 ? 11 : today.getMonth() - 1].slice(0,3)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spendingChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="week"
                      tick={{ fill: '#717786', fontSize: 9, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                      axisLine={{ stroke: '#c1c6d7', strokeWidth: 0.5 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#717786', fontSize: 9, fontFamily: 'Inter' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => v === 0 ? '' : `€${v}`}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #c1c6d7', borderRadius: '12px', fontFamily: 'Inter', fontSize: 11 }}
                      labelStyle={{ color: '#1a1b1f', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}
                      formatter={(val, name) => [`€ ${val.toLocaleString()}`, name]}
                    />
                    <Line type="monotone" dataKey="This Month" stroke="#0058bc" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Last Month"  stroke="#c1c6d7" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Spending Composition Donut */}
            <div className="col-span-12 lg:col-span-4 bg-surface-container-low rounded-2xl p-8 flex flex-col items-center justify-between">
              <div className="space-y-1 w-full">
                <h3 className="text-xl font-bold tracking-tight">Spending Intent</h3>
                <p className="text-xs text-on-surface-variant">Essential vs optional outflows</p>
              </div>
              <div className="relative w-40 h-40 my-6 flex items-center justify-center">
                <PieChart width={160} height={160}>
                  <Pie
                    data={donutData}
                    cx={80} cy={80}
                    innerRadius={52} outerRadius={68}
                    startAngle={90} endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill="#0058bc" />
                    <Cell fill="#e3e2e7" />
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-extrabold tracking-tighter">
                    {totalAssetsExpenses > 0 ? `${essentialPct}%` : '—'}
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
                  <span className="text-sm font-bold">{loading ? '—' : fmtShort(typeBreakdown.essential)}</span>
                </div>
                <div className="flex justify-between items-center bg-surface-container-lowest px-4 py-3 rounded-xl opacity-60">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-surface-container-highest"></span>
                    <span className="text-sm font-semibold">Optional</span>
                  </div>
                  <span className="text-sm font-bold">{loading ? '—' : fmtShort(typeBreakdown.useless)}</span>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="col-span-12 lg:col-span-5 bg-surface-container-lowest rounded-2xl p-8 space-y-6 shadow-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold tracking-tight">Recent Activity</h3>
                <button
                  onClick={() => onNavigate('monthly')}
                  className="text-primary text-[10px] font-extrabold uppercase tracking-widest hover:underline"
                >
                  View Ledger
                </button>
              </div>

              {loading ? (
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Loading...</p>
              ) : recentTx.length === 0 ? (
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">No transactions yet.</p>
              ) : (
                <div className="space-y-1">
                  {recentTx.map(tx => (
                    <div key={`${tx.kind}-${tx.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.kind === 'income' ? 'bg-secondary-container/20' : 'bg-surface-container'}`}>
                          <span className={`material-symbols-outlined ${tx.kind === 'income' ? 'text-secondary' : 'text-on-surface-variant'}`} style={{ fontSize: '18px' }}>
                            {CAT_ICONS[tx.category] || 'receipt_long'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-on-surface">{tx.description || tx.category}</p>
                          <p className="text-[10px] font-medium text-on-surface-variant">{tx.category} • {fmtTxDate(tx.date)}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${tx.kind === 'income' ? 'text-secondary' : 'text-on-surface'}`}>
                        {tx.kind === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Allocation Strategy */}
            <div className="col-span-12 lg:col-span-7 bg-surface-container-low rounded-2xl p-8 space-y-6 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight">Allocation Strategy</h3>
                <p className="text-xs text-on-surface-variant">All-time expense distribution</p>
              </div>
              <div className="space-y-5 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface">Essential Spending</span>
                    <span className="text-[11px] font-bold text-on-surface-variant">{essentialPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${essentialPct}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface">Optional / Useless</span>
                    <span className="text-[11px] font-bold text-on-surface-variant">{100 - essentialPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-tertiary rounded-full" style={{ width: `${100 - essentialPct}%` }} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-outline-variant/10">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Total Income</span>
                  <p className="text-lg font-bold text-secondary">{loading ? '—' : fmtShort(totalAssetsIncome)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Total Expenses</span>
                  <p className="text-lg font-bold text-tertiary">{loading ? '—' : '-' + fmtShort(totalAssetsExpenses)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Net Balance</span>
                  <p className={`text-lg font-bold ${totalAssets >= 0 ? 'text-secondary' : 'text-tertiary'}`}>{loading ? '—' : (totalAssets < 0 ? '-' : '') + fmtShort(totalAssets)}</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('monthly')}
                className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 transition-opacity mt-2"
              >
                Open Monthly Overview
              </button>
            </div>

          </div>

          {/* ── Footer ── */}
          <footer className="py-8 flex items-center justify-center border-t border-outline-variant/20 mt-6">
            <p className="text-[10px] text-on-surface-variant/50 font-medium">
              Built by Jakob ·{' '}
              <a href="https://github.com/stadjakobCC" target="_blank" rel="noopener noreferrer" className="hover:text-on-surface-variant transition-colors">GitHub</a>
            </p>
          </footer>

        </div>
      </main>
    </div>
  )
}
