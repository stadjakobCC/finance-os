import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
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

export default function Dashboard({ session, onNavigate }) {
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
  const totalAssets         = totalAssetsIncome - totalAssetsExpenses + 0 // portfolio hardcoded to €0

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
    <div className="flex min-h-screen">

      {/* ── Sidebar (exact from HTML) ── */}
      <aside className="fixed left-0 top-0 h-full flex flex-col py-8 bg-[#1c1b1b] w-64 z-50">
        <div className="px-8 mb-12">
          <h1 className="text-2xl font-serif italic text-[#f2ca50]">FinanceOS</h1>
          <p className="font-sans uppercase tracking-[0.1em] text-[10px] text-gray-500 mt-1">Sovereign Curator</p>
        </div>
        <nav className="flex-1 flex flex-col">
          <a
            className="flex items-center gap-4 px-8 py-4 text-[#f2ca50] border-l-2 border-[#f2ca50] font-bold bg-[#2a2a2a]/50 transition-all duration-300 cursor-pointer"
            onClick={() => onNavigate('dashboard')}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Dashboard</span>
          </a>
          <a
            className="flex items-center gap-4 px-8 py-4 text-gray-500 hover:text-gray-200 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer"
            onClick={() => onNavigate('monthly')}
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Monthly Overview</span>
          </a>
          <a
            className="flex items-center gap-4 px-8 py-4 text-gray-500 hover:text-gray-200 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer"
            onClick={() => onNavigate('portfolio')}
          >
            <span className="material-symbols-outlined">account_balance_wallet</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Portfolio</span>
          </a>
          <a className="flex items-center gap-4 px-8 py-4 text-gray-500 hover:text-gray-200 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer" onClick={() => onNavigate('savings')}>
            <span className="material-symbols-outlined">savings</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Savings Goals</span>
          </a>
        </nav>
        <div className="px-8 mt-auto flex flex-col gap-2">
          <a className="flex items-center gap-4 py-3 text-gray-500 hover:text-gray-200 transition-colors cursor-pointer">
            <span className="material-symbols-outlined">settings</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Settings</span>
          </a>
          <a className="flex items-center gap-4 py-3 text-gray-500 hover:text-gray-200 transition-colors cursor-pointer">
            <span className="material-symbols-outlined">help</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Support</span>
          </a>
          <button
            className="mt-2 bg-gradient-to-b from-[#f2ca50] to-[#d4af37] text-[#3c2f00] px-6 py-3 font-sans uppercase tracking-[0.1em] text-xs font-bold transition-transform duration-200 active:scale-95"
            onClick={() => supabase.auth.signOut()}
          >
            Sign Out
          </button>
          <div className="font-sans text-gray-600 text-[0.6rem] py-1 truncate">{session.user.email}</div>
        </div>
      </aside>

      {/* ── Top Header (exact from HTML) ── */}
      <header className="fixed left-64 right-0 top-0 z-40 bg-[#131313]/80 backdrop-blur-xl flex justify-between items-center px-8 py-4">
        <div className="flex items-center gap-6 flex-1">
          <div className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-0 top-1/2 -translate-y-1/2 text-gray-500 text-lg">search</span>
            <input
              className="bg-transparent border-b border-outline-variant/30 w-full pl-8 py-1 text-[10px] tracking-widest uppercase font-sans placeholder:text-gray-600 focus:outline-none focus:border-[#f2ca50]"
              placeholder="SEARCH ASSETS..."
              type="text"
            />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-gray-400 hover:text-[#f2ca50] transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="flex items-center gap-4">
            <span className="font-serif italic text-on-surface text-lg">{session.user.email.split('@')[0]}</span>
            <div className="w-10 h-10 bg-[#2a2a2a] border border-outline-variant/20 flex items-center justify-center text-[#f2ca50] font-bold text-sm">
              {initial}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content (exact from HTML) ── */}
      <main className="ml-64 pt-24 pb-12 px-12 min-h-screen flex flex-col flex-1">

        {/* ── Hero Section: Total Assets ── */}
        <section className="mb-16">
          <p className="font-sans uppercase tracking-[0.2em] text-xs text-outline mb-4">Current Liquidity &amp; Value</p>
          <div className="flex items-baseline gap-4">
            <h2 className="font-serif italic text-7xl md:text-8xl text-[#f2ca50] font-bold">
              {loading ? '—' : fmt(totalAssets)}
            </h2>
          </div>
          <div className="mt-8 flex gap-12">
            <div>
              <p className="font-sans uppercase tracking-widest text-[10px] text-gray-500">Essential Ratio</p>
              <p className="text-xl font-serif italic mt-1">
                {totalAssetsExpenses > 0 ? `${essentialPct}%` : '—'}
              </p>
            </div>
            <div>
              <p className="font-sans uppercase tracking-widest text-[10px] text-gray-500">Total Income</p>
              <p className="text-xl font-serif italic mt-1 text-[#b6d5cb]">{loading ? '—' : fmtShort(totalAssetsIncome)}</p>
            </div>
            <div>
              <p className="font-sans uppercase tracking-widest text-[10px] text-gray-500">Total Expenses</p>
              <p className="text-xl font-serif italic mt-1 text-[#ffb4ab]">{loading ? '—' : fmtShort(totalAssetsExpenses)}</p>
            </div>
          </div>
        </section>

        {/* ── Bento Grid (exact from HTML) ── */}
        <div className="grid grid-cols-12 gap-8">

          {/* ── Left: Recent Transactions ── */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
            <div className="bg-surface-container-low p-8 relative">
              <div className="flex justify-between items-center mb-10">
                <h3 className="font-serif italic text-2xl text-on-surface">Recent Transactions</h3>
                <a
                  className="font-sans uppercase tracking-widest text-[10px] text-[#f2ca50] hover:text-white transition-colors cursor-pointer"
                  onClick={() => onNavigate('monthly')}
                >
                  View Journal
                </a>
              </div>

              {loading ? (
                <p className="font-sans uppercase tracking-widest text-[10px] text-gray-500">Loading...</p>
              ) : recentTx.length === 0 ? (
                <p className="font-sans uppercase tracking-widest text-[10px] text-gray-500">No transactions yet.</p>
              ) : (
                <div className="space-y-8">
                  {recentTx.map(tx => (
                    <div key={`${tx.kind}-${tx.id}`} className="flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-[#2a2a2a] flex items-center justify-center text-[#f2ca50]">
                          <span className="material-symbols-outlined">
                            {CAT_ICONS[tx.category] || 'receipt_long'}
                          </span>
                        </div>
                        <div>
                          <p className="font-sans uppercase tracking-widest text-[11px] text-on-surface">
                            {tx.description || tx.category}
                          </p>
                          <p className="font-sans text-[10px] text-gray-500 tracking-tighter">
                            {fmtTxDate(tx.date)} • {tx.category.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <p className={`font-serif italic text-lg group-hover:text-[#f2ca50] transition-colors ${tx.kind === 'income' ? 'text-[#b6d5cb]' : 'text-on-surface'}`}>
                        {tx.kind === 'income' ? '+ ' : '- '}{fmt(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Analytics ── */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-8">

            {/* Spending Trajectory Line Chart */}
            <div className="bg-surface-container-low p-8 h-80 relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-serif italic text-2xl text-on-surface">Spending Trajectory</h3>
                  <p className="font-sans uppercase tracking-widest text-[10px] text-gray-500 mt-1">VS PREVIOUS PERIOD</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#f2ca50]" />
                    <span className="font-sans text-[9px] uppercase tracking-widest">{MONTH_NAMES[today.getMonth()]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#353534]" />
                    <span className="font-sans text-[9px] uppercase tracking-widest">
                      {MONTH_NAMES[today.getMonth() === 0 ? 11 : today.getMonth() - 1]}
                    </span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="70%">
                <LineChart data={spendingChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="week"
                    tick={{ fill: '#4d4635', fontSize: 8, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    axisLine={{ stroke: '#4d4635', strokeWidth: 0.5 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#4d4635', fontSize: 8, fontFamily: 'Inter' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => v === 0 ? '' : `€${v}`}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1c1b1b', border: '1px solid #4d4635', borderRadius: 0, fontFamily: 'Inter', fontSize: 10 }}
                    labelStyle={{ color: '#d0c5af', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    formatter={(val, name) => [`€ ${val.toLocaleString()}`, name]}
                  />
                  <Line
                    type="monotone" dataKey="This Month"
                    stroke="#f2ca50" strokeWidth={1.5} dot={false} opacity={0.9}
                  />
                  <Line
                    type="monotone" dataKey="Last Month"
                    stroke="#353534" strokeWidth={1.5} dot={false} opacity={0.6}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Donut + Allocation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Donut Chart */}
              <div className="bg-surface-container-low p-8 flex flex-col justify-center items-center relative h-64">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <PieChart width={128} height={128}>
                    <Pie
                      data={donutData}
                      cx={64} cy={64}
                      innerRadius={46} outerRadius={58}
                      startAngle={90} endAngle={-270}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      <Cell fill="#f2ca50" />
                      <Cell fill="#2a2a2a" />
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="font-serif italic text-2xl">
                      {totalAssetsExpenses > 0 ? `${essentialPct}%` : '—'}
                    </span>
                    <span className="font-sans text-[8px] uppercase tracking-tighter text-gray-500">Essential</span>
                  </div>
                </div>
                <h4 className="font-sans uppercase tracking-[0.2em] text-[10px] text-on-surface mt-6">Spending Composition</h4>
              </div>

              {/* Allocation Strategy */}
              <div className="bg-surface-container-low p-8 flex flex-col justify-between">
                <div>
                  <h4 className="font-serif italic text-xl mb-4">Allocation Strategy</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-[10px] tracking-widest uppercase mb-2">
                        <span className="text-gray-400">Essential</span>
                        <span className="text-[#f2ca50]">{fmtShort(typeBreakdown.essential)}</span>
                      </div>
                      <div className="w-full h-[2px] bg-[#2a2a2a]">
                        <div
                          className="h-full bg-[#f2ca50]"
                          style={{ width: `${essentialPct}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] tracking-widest uppercase mb-2">
                        <span className="text-gray-400">Speculative / Optional</span>
                        <span className="text-on-surface">{fmtShort(typeBreakdown.useless)}</span>
                      </div>
                      <div className="w-full h-[2px] bg-[#2a2a2a]">
                        <div
                          className="h-full bg-[#cec6af]"
                          style={{ width: `${100 - essentialPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className="w-full py-3 text-[#3c2f00] font-sans uppercase tracking-[0.2em] text-[10px] font-bold mt-6"
                  style={{ background: 'linear-gradient(180deg, #f2ca50 0%, #d4af37 100%)' }}
                  onClick={() => onNavigate('monthly')}
                >
                  View Monthly Overview
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer (exact from HTML) ── */}
        <footer className="bg-[#131313] py-12 px-8 flex flex-col items-center gap-4 w-full border-t border-[#e5e2e1]/15 mt-auto">
          <div className="flex gap-12 mb-4">
            <a className="font-sans text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors" href="#">Terms</a>
            <a className="font-sans text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors" href="#">Privacy</a>
            <a className="font-sans text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors" href="#">Compliance</a>
            <a className="font-sans text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors" href="#">Contact</a>
          </div>
          <p className="font-serif italic text-sm text-[#f2ca50]">FinanceOS</p>
          <p className="font-sans text-[10px] uppercase tracking-widest text-gray-600">© FinanceOS. All rights reserved.</p>
        </footer>
      </main>
    </div>
  )
}
