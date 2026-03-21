import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

export default function SavingsGoals({ session, onNavigate }) {
  const userId  = session.user.id
  const initial = session.user.email.charAt(0).toUpperCase()

  const [goals,       setGoals]       = useState([])
  const [loading,     setLoading]     = useState(true)

  // New goal form
  const [showForm,    setShowForm]    = useState(false)
  const [formName,    setFormName]    = useState('')
  const [formTarget,  setFormTarget]  = useState('')
  const [formCurrent, setFormCurrent] = useState('')
  const [formStatus,  setFormStatus]  = useState(null) // null | 'loading' | 'success' | 'error'

  // Add money
  const [addMoneyId,  setAddMoneyId]  = useState(null)
  const [addAmount,   setAddAmount]   = useState('')
  const [addStatus,   setAddStatus]   = useState(null)

  useEffect(() => { loadGoals() }, []) // eslint-disable-line

  async function loadGoals() {
    const { data, error } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) console.error('[goals] fetch error:', error)
    else setGoals(data || [])
    setLoading(false)
  }

  async function handleCreateGoal(e) {
    e.preventDefault()
    setFormStatus('loading')
    const { error } = await supabase
      .from('savings')
      .insert({
        user_id:        userId,
        name:           formName,
        target_amount:  parseFloat(formTarget),
        current_amount: parseFloat(formCurrent) || 0,
      })
    if (error) {
      console.error('[goals] create error:', error)
      setFormStatus('error')
      setTimeout(() => setFormStatus(null), 3000)
    } else {
      setFormStatus('success')
      setFormName(''); setFormTarget(''); setFormCurrent('')
      loadGoals()
      setTimeout(() => { setFormStatus(null); setShowForm(false) }, 1500)
    }
  }

  async function handleAddMoney(e, goalId) {
    e.preventDefault()
    setAddStatus('loading')
    const goal = goals.find(g => g.id === goalId)
    const newAmount = goal.current_amount + parseFloat(addAmount)
    const { error } = await supabase
      .from('savings')
      .update({ current_amount: newAmount })
      .eq('id', goalId)
      .eq('user_id', userId)
    if (error) {
      console.error('[goals] add money error:', error)
      setAddStatus('error')
      setTimeout(() => setAddStatus(null), 3000)
    } else {
      setAddStatus('success')
      setAddAmount('')
      loadGoals()
      setTimeout(() => { setAddStatus(null); setAddMoneyId(null) }, 1200)
    }
  }

  async function handleDelete(goalId) {
    const { error } = await supabase
      .from('savings')
      .delete()
      .eq('id', goalId)
      .eq('user_id', userId)
    if (error) console.error('[goals] delete error:', error)
    else setGoals(prev => prev.filter(g => g.id !== goalId))
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function fmtEur(n) {
    return '€ ' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function pctOf(goal) {
    if (!goal.target_amount) return 0
    return Math.min(100, (goal.current_amount / goal.target_amount) * 100)
  }

  const totalSaved  = useMemo(() => goals.reduce((s, g) => s + g.current_amount, 0), [goals])
  const totalTarget = useMemo(() => goals.reduce((s, g) => s + g.target_amount,  0), [goals])
  const overallPct  = totalTarget > 0 ? (totalSaved / totalTarget * 100).toFixed(1) : 0

  const [mainGoal, ...restGoals] = goals

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">

      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 h-full flex flex-col py-8 bg-[#1c1b1b] w-64 z-50">
        <div className="px-8 mb-12">
          <h1 className="text-2xl font-serif italic text-[#f2ca50]">FinanceOS</h1>
          <p className="font-sans uppercase tracking-[0.1em] text-[10px] text-gray-500 mt-1">Sovereign Curator</p>
        </div>
        <nav className="flex-1 space-y-2">
          <a className="flex items-center gap-4 px-8 py-3 text-gray-500 hover:text-gray-200 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Dashboard</span>
          </a>
          <a className="flex items-center gap-4 px-8 py-3 text-gray-500 hover:text-gray-200 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer" onClick={() => onNavigate('monthly')}>
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Monthly Overview</span>
          </a>
          <a className="flex items-center gap-4 px-8 py-3 text-gray-500 hover:text-gray-200 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer" onClick={() => onNavigate('portfolio')}>
            <span className="material-symbols-outlined">account_balance_wallet</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Portfolio</span>
          </a>
          <a className="flex items-center gap-4 px-8 py-3 text-[#f2ca50] border-l-2 border-[#f2ca50] font-bold bg-[#2a2a2a]/50">
            <span className="material-symbols-outlined">savings</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Savings Goals</span>
          </a>
        </nav>
        <div className="mt-auto px-8 space-y-4">
          <button
            className="w-full text-[#3c2f00] py-3 font-sans uppercase tracking-widest text-xs font-bold active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(to bottom, #f2ca50, #d4af37)' }}
            onClick={() => supabase.auth.signOut()}
          >
            Sign Out
          </button>
          <div className="pt-6 space-y-2 border-t border-[#4d4635]/15">
            <div className="font-sans text-gray-600 text-[0.6rem] truncate">{session.user.email}</div>
            <a className="flex items-center gap-4 py-2 text-gray-500 hover:text-gray-200 transition-colors cursor-pointer">
              <span className="material-symbols-outlined">settings</span>
              <span className="font-sans uppercase tracking-[0.1em] text-xs">Settings</span>
            </a>
            <a className="flex items-center gap-4 py-2 text-gray-500 hover:text-gray-200 transition-colors cursor-pointer">
              <span className="material-symbols-outlined">help</span>
              <span className="font-sans uppercase tracking-[0.1em] text-xs">Support</span>
            </a>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen">

        {/* ── Header ── */}
        <header className="flex justify-between items-center w-full px-12 py-6 bg-[#131313]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#99907c]">search</span>
              <input
                className="bg-[#2a2a2a] border-none text-on-surface text-sm pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-[#f2ca50] transition-all"
                placeholder="Search Goals..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex gap-4">
              <button className="text-gray-400 hover:text-[#f2ca50] transition-colors">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button className="text-gray-400 hover:text-[#f2ca50] transition-colors">
                <span className="material-symbols-outlined">settings</span>
              </button>
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-[#4d4635]/20">
              <span className="font-sans uppercase tracking-widest text-[10px] text-gray-400">{session.user.email.split('@')[0]}</span>
              <div className="w-10 h-10 bg-[#2a2a2a] flex items-center justify-center border border-[#f2ca50]/20 text-[#f2ca50] font-bold text-sm">
                {initial}
              </div>
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="px-12 py-12 max-w-7xl w-full mx-auto">

          {/* ── Page Header ── */}
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 className="text-6xl font-serif italic text-on-surface mb-2 tracking-tight">Future Aspirations</h2>
              <p className="font-sans uppercase tracking-[0.2em] text-xs text-[#99907c]">Strategic Capital Preservation &amp; Growth</p>
            </div>
            <button
              onClick={() => setShowForm(s => !s)}
              className="flex items-center gap-2 px-8 py-4 font-sans uppercase tracking-[0.15em] text-xs font-bold text-[#3c2f00] hover:brightness-110 transition-all active:scale-95"
              style={{ background: 'linear-gradient(to bottom, #f2ca50, #d4af37)' }}
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Initiate New Goal
            </button>
          </div>

          {/* ── New Goal Form ── */}
          {showForm && (
            <div className="bg-[#1c1b1b] p-8 mb-8 border-b border-[#4d4635]">
              <h4 className="font-serif italic text-xl mb-6 text-[#f2ca50]">New Savings Goal</h4>
              <form onSubmit={handleCreateGoal} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                  <label className="font-sans uppercase tracking-[0.15em] text-[0.7rem] font-semibold text-[#d0c5af]">Goal Name</label>
                  <input
                    type="text"
                    className="w-full bg-transparent border-b border-[#99907c] focus:border-[#f2ca50] text-sm py-2 focus:outline-none text-on-surface"
                    placeholder="e.g. Emergency Fund"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-sans uppercase tracking-[0.15em] text-[0.7rem] font-semibold text-[#d0c5af]">Target Amount (€)</label>
                  <input
                    type="number" min="0" step="any"
                    className="w-full bg-transparent border-b border-[#99907c] focus:border-[#f2ca50] text-sm py-2 focus:outline-none text-on-surface"
                    placeholder="0.00"
                    value={formTarget}
                    onChange={e => setFormTarget(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-sans uppercase tracking-[0.15em] text-[0.7rem] font-semibold text-[#d0c5af]">Already Saved (€)</label>
                  <input
                    type="number" min="0" step="any"
                    className="w-full bg-transparent border-b border-[#99907c] focus:border-[#f2ca50] text-sm py-2 focus:outline-none text-on-surface"
                    placeholder="0.00"
                    value={formCurrent}
                    onChange={e => setFormCurrent(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={formStatus === 'loading'}
                    className="flex-1 py-2.5 font-sans uppercase tracking-widest text-[10px] font-bold text-[#3c2f00] disabled:opacity-50"
                    style={{ background: 'linear-gradient(to bottom, #f2ca50, #d4af37)' }}
                  >
                    {formStatus === 'loading' ? '...' : formStatus === 'success' ? '✓ Created' : formStatus === 'error' ? 'Error' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-3 py-2.5 font-sans uppercase tracking-widest text-[10px] text-gray-500 border border-[#4d4635] hover:text-on-surface transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Bento Grid ── */}
          {loading ? (
            <p className="font-sans uppercase tracking-widest text-[10px] text-gray-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-12 gap-8 mb-16">

              {/* ── Main Goal Card ── */}
              <div className="col-span-12 bg-[#1c1b1b] p-10 flex flex-col justify-between min-h-[400px] group">
                {mainGoal ? (
                  <>
                    <div className="flex justify-between items-start mb-12">
                      <div>
                        <span className="font-sans uppercase tracking-[0.1em] text-[10px] text-[#f2ca50] mb-2 block">Priority I</span>
                        <h3 className="text-4xl font-serif italic text-on-surface">{mainGoal.name}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                          <span className="text-3xl font-light text-on-surface">{fmtEur(mainGoal.current_amount)}</span>
                          <p className="text-xs text-[#99907c] uppercase tracking-widest mt-1">of {fmtEur(mainGoal.target_amount)} target</p>
                        </div>
                        {/* Action buttons — visible on hover */}
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setAddMoneyId(addMoneyId === mainGoal.id ? null : mainGoal.id); setAddAmount('') }}
                            className="flex items-center gap-1 px-3 py-1.5 font-sans uppercase tracking-widest text-[9px] border border-[#f2ca50]/30 text-[#f2ca50] hover:bg-[#f2ca50]/10 transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>add</span>
                            Add
                          </button>
                          <button
                            onClick={() => handleDelete(mainGoal.id)}
                            className="p-1.5 text-gray-600 hover:text-[#ffb4ab] border border-[#4d4635]/30 hover:border-[#ffb4ab]/30 transition-colors"
                            title="Delete goal"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Add money inline form */}
                    {addMoneyId === mainGoal.id && (
                      <form onSubmit={e => handleAddMoney(e, mainGoal.id)} className="flex gap-3 mb-8 items-end">
                        <div className="flex-1 space-y-1">
                          <label className="font-sans uppercase tracking-[0.15em] text-[0.65rem] font-semibold text-[#d0c5af]">Amount to Add (€)</label>
                          <input
                            type="number" min="0" step="any" autoFocus
                            className="w-full bg-transparent border-b border-[#99907c] focus:border-[#f2ca50] text-sm py-1.5 focus:outline-none text-on-surface"
                            placeholder="0.00"
                            value={addAmount}
                            onChange={e => setAddAmount(e.target.value)}
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={addStatus === 'loading'}
                          className="px-6 py-1.5 font-sans uppercase tracking-widest text-[9px] font-bold text-[#3c2f00] disabled:opacity-50"
                          style={{ background: 'linear-gradient(to bottom, #f2ca50, #d4af37)' }}
                        >
                          {addStatus === 'loading' ? '...' : addStatus === 'success' ? '✓' : 'Save'}
                        </button>
                        <button type="button" onClick={() => setAddMoneyId(null)} className="px-3 py-1.5 text-gray-500 border border-[#4d4635] font-sans uppercase tracking-widest text-[9px] hover:text-on-surface">×</button>
                      </form>
                    )}

                    <div className="mt-auto">
                      <div className="flex justify-between items-end mb-4">
                        <span className="text-5xl font-sans font-light text-[#f2ca50]">{pctOf(mainGoal).toFixed(1)}%</span>
                        <span className="text-xs text-[#99907c] uppercase tracking-[0.2em]">Completion Path</span>
                      </div>
                      <div className="w-full h-[2px] bg-[#2a2a2a] relative">
                        <div
                          className="absolute top-0 left-0 h-full transition-all duration-700"
                          style={{ width: `${pctOf(mainGoal)}%`, background: 'linear-gradient(to right, #f2ca50, #d4af37)' }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center h-full text-center py-20">
                    <span className="material-symbols-outlined text-4xl text-[#4d4635] mb-4">savings</span>
                    <p className="font-sans uppercase tracking-widest text-[10px] text-gray-600 mb-2">No Goals Yet</p>
                    <p className="text-sm text-gray-600 font-serif italic">Click "Initiate New Goal" to begin</p>
                  </div>
                )}
              </div>

              {/* ── Smaller Goal Cards ── */}
              {restGoals.map(goal => (
                <div key={goal.id} className="col-span-12 lg:col-span-6 bg-[#2a2a2a] p-8 flex flex-col justify-between group">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-2xl font-serif italic text-on-surface">{goal.name}</h3>
                      <p className="text-[10px] text-[#99907c] uppercase tracking-widest mt-1">Savings Goal</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <span className="text-xl font-sans text-on-surface">{fmtEur(goal.current_amount)}</span>
                        <p className="text-[10px] text-[#99907c] uppercase tracking-tighter mt-1">Target: {fmtEur(goal.target_amount)}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setAddMoneyId(addMoneyId === goal.id ? null : goal.id); setAddAmount('') }}
                          className="flex items-center gap-1 px-2 py-1 font-sans uppercase tracking-widest text-[8px] border border-[#f2ca50]/30 text-[#f2ca50] hover:bg-[#f2ca50]/10 transition-colors"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>add</span>
                          Add
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="p-1 text-gray-600 hover:text-[#ffb4ab] transition-colors"
                          title="Delete goal"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Add money inline */}
                  {addMoneyId === goal.id && (
                    <form onSubmit={e => handleAddMoney(e, goal.id)} className="flex gap-2 mb-6 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="font-sans uppercase tracking-[0.15em] text-[0.6rem] font-semibold text-[#d0c5af]">Amount (€)</label>
                        <input
                          type="number" min="0" step="any" autoFocus
                          className="w-full bg-transparent border-b border-[#99907c] focus:border-[#f2ca50] text-sm py-1 focus:outline-none text-on-surface"
                          placeholder="0.00"
                          value={addAmount}
                          onChange={e => setAddAmount(e.target.value)}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={addStatus === 'loading'}
                        className="px-4 py-1 font-sans uppercase tracking-widest text-[9px] font-bold text-[#3c2f00] disabled:opacity-50"
                        style={{ background: 'linear-gradient(to bottom, #f2ca50, #d4af37)' }}
                      >
                        {addStatus === 'success' ? '✓' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setAddMoneyId(null)} className="px-2 py-1 text-gray-500 font-sans uppercase tracking-widest text-[9px] border border-[#4d4635]">×</button>
                    </form>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-sans text-on-surface">{pctOf(goal).toFixed(1)}%</span>
                      <span className="text-[9px] text-[#99907c] uppercase tracking-widest">
                        {pctOf(goal) >= 100 ? 'Complete' : pctOf(goal) >= 75 ? 'Final Phase' : pctOf(goal) >= 50 ? 'Growth Phase' : 'Accumulation'}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-[#131313] relative">
                      <div
                        className="absolute top-0 left-0 h-full transition-all duration-700"
                        style={{ width: `${pctOf(goal)}%`, background: 'linear-gradient(to right, #f2ca50, #d4af37)' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Capital Velocity ── */}
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/3">
              <h3 className="text-3xl font-serif italic text-on-surface mb-6">Capital Velocity</h3>
              <p className="text-sm text-[#99907c] leading-loose mb-8">
                {goals.length > 0
                  ? `You have ${goals.length} active goal${goals.length > 1 ? 's' : ''} with an overall completion rate of ${overallPct}%. Keep adding to your goals to accelerate your trajectory.`
                  : 'Create savings goals to track your capital velocity and monitor your progress over time.'}
              </p>
              <div className="space-y-6">
                <div className="flex justify-between border-b border-[#4d4635]/10 pb-4">
                  <span className="text-xs uppercase tracking-widest text-[#99907c]">Total Saved</span>
                  <span className="text-sm text-on-surface">{fmtEur(totalSaved)}</span>
                </div>
                <div className="flex justify-between border-b border-[#4d4635]/10 pb-4">
                  <span className="text-xs uppercase tracking-widest text-[#99907c]">Total Target</span>
                  <span className="text-sm text-on-surface">{fmtEur(totalTarget)}</span>
                </div>
                <div className="flex justify-between border-b border-[#4d4635]/10 pb-4">
                  <span className="text-xs uppercase tracking-widest text-[#99907c]">Overall Progress</span>
                  <span className="text-sm text-[#f2ca50]">{overallPct}%</span>
                </div>
              </div>
            </div>
            <div className="lg:w-2/3 w-full bg-[#1c1b1b] p-10 h-64 flex items-center justify-center border border-[#4d4635]/5">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-[#f2ca50] mb-4 opacity-50" style={{ fontSize: '48px' }}>auto_graph</span>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#99907c]">Interactive Projection Module</p>
                <p className="text-xs text-[#f2ca50] mt-2 italic font-serif">Available in Sovereign Tier</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="flex flex-col items-center gap-4 w-full py-12 px-8 mt-auto border-t border-[#e5e2e1]/15 bg-[#131313]">
          <div className="font-serif italic text-sm text-[#f2ca50]">FinanceOS</div>
          <div className="flex gap-8">
            <a className="font-sans text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors" href="#">Terms</a>
            <a className="font-sans text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors" href="#">Privacy</a>
            <a className="font-sans text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors" href="#">Compliance</a>
            <a className="font-sans text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors" href="#">Contact</a>
          </div>
          <p className="font-sans text-[10px] uppercase tracking-widest text-gray-600 mt-4">© FinanceOS. All rights reserved.</p>
        </footer>

      </main>
    </div>
  )
}
