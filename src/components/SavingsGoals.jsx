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
    <div className="min-h-screen flex bg-surface">

      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 h-full z-50 flex flex-col p-4 bg-slate-50/70 backdrop-blur-xl w-64 border-r border-slate-200/50">
        <div className="mb-8 px-4 py-2">
          <h1 className="text-lg font-bold tracking-tighter text-slate-900">FinanceOS</h1>
          <p className="text-[10px] font-medium tracking-widest text-on-surface-variant uppercase mt-0.5">Premium Member</p>
        </div>
        <nav className="flex-1 space-y-1">
          <a onClick={() => onNavigate('dashboard')} className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl">
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a onClick={() => onNavigate('monthly')} className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl">
            <span className="material-symbols-outlined">calendar_month</span>
            <span>Overview</span>
          </a>
          <a onClick={() => onNavigate('portfolio')} className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl">
            <span className="material-symbols-outlined">account_balance_wallet</span>
            <span>Portfolio</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-blue-600 bg-white/50 rounded-xl shadow-sm font-sans text-sm font-medium tracking-tight cursor-pointer">
            <span className="material-symbols-outlined">savings</span>
            <span>Savings</span>
          </a>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200/50">
          <button
            onClick={() => setShowForm(s => !s)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            New Aspiration
          </button>
          <div className="mt-6 flex items-center gap-3 px-2">
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
      <main className="ml-64 flex-1 flex flex-col min-h-screen">

        {/* ── Header ── */}
        <header className="flex justify-between items-center w-full px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-30 border-b border-outline-variant/20">
          <div className="flex items-center gap-3 bg-surface-container-low px-4 py-2 rounded-full w-96">
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '18px' }}>search</span>
            <input
              className="bg-transparent border-none text-sm text-on-surface-variant focus:ring-0 w-full placeholder:text-on-surface-variant/50"
              placeholder="Search goals..."
              type="text"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="text-on-surface-variant hover:opacity-70 transition-opacity">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="text-on-surface-variant hover:opacity-70 transition-opacity">
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="p-10 max-w-7xl mx-auto w-full">

          {/* ── Page Header ── */}
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2">Future Aspirations</h2>
              <p className="text-on-surface-variant">Curating your financial milestones with intentionality.</p>
            </div>
            <button
              onClick={() => setShowForm(s => !s)}
              className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:shadow-xl hover:shadow-primary/20 active:scale-95 text-sm"
            >
              <span className="material-symbols-outlined">auto_awesome</span>
              Add New Aspiration
            </button>
          </div>

          {/* ── New Goal Form ── */}
          {showForm && (
            <div className="bg-surface-container-lowest rounded-[2rem] p-8 mb-8 border border-outline-variant/10 shadow-sm">
              <h4 className="text-lg font-bold mb-6 text-on-surface">New Savings Goal</h4>
              <form onSubmit={handleCreateGoal} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Goal Name</label>
                  <input
                    type="text"
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30"
                    placeholder="e.g. Emergency Fund"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Target Amount (€)</label>
                  <input
                    type="number" min="0" step="any"
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30"
                    placeholder="0.00"
                    value={formTarget}
                    onChange={e => setFormTarget(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Already Saved (€)</label>
                  <input
                    type="number" min="0" step="any"
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30"
                    placeholder="0.00"
                    value={formCurrent}
                    onChange={e => setFormCurrent(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={formStatus === 'loading'}
                    className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {formStatus === 'loading' ? '...' : formStatus === 'success' ? '✓ Created' : formStatus === 'error' ? 'Error' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-3 text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container transition-colors text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Bento Grid ── */}
          {loading ? (
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">Loading...</p>
          ) : (
            <div className="grid grid-cols-12 gap-8 mb-16">

              {/* ── Main Goal Card (Featured) ── */}
              <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-[2rem] p-8 relative overflow-hidden flex flex-col group border border-outline-variant/10 shadow-sm min-h-[360px]">
                {mainGoal ? (
                  <>
                    {/* Decorative icon */}
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                      <span className="material-symbols-outlined" style={{ fontSize: '120px' }}>savings</span>
                    </div>

                    <div className="flex items-start justify-between mb-12">
                      <div>
                        <span className="bg-secondary-container/20 text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold tracking-wider mb-4 inline-block">
                          {pctOf(mainGoal) >= 100 ? 'COMPLETE' : pctOf(mainGoal) >= 75 ? 'FINAL PHASE' : 'ON TRACK'}
                        </span>
                        <h3 className="text-3xl font-bold text-on-surface">{mainGoal.name}</h3>
                        <p className="text-on-surface-variant">Priority Goal</p>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-1">Target</p>
                          <p className="text-xl font-bold text-on-surface">{fmtEur(mainGoal.target_amount)}</p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setAddMoneyId(addMoneyId === mainGoal.id ? null : mainGoal.id); setAddAmount('') }}
                            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-primary/20 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>add</span>
                            Add
                          </button>
                          <button
                            onClick={() => handleDelete(mainGoal.id)}
                            className="p-1.5 text-on-surface-variant hover:text-tertiary border border-outline-variant/30 hover:border-tertiary/30 rounded-lg transition-colors"
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
                        <div className="flex-1 space-y-1.5">
                          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Amount to Add (€)</label>
                          <input
                            type="number" min="0" step="any" autoFocus
                            className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30"
                            placeholder="0.00"
                            value={addAmount}
                            onChange={e => setAddAmount(e.target.value)}
                            required
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={addStatus === 'loading'}
                          className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
                        >
                          {addStatus === 'loading' ? '...' : addStatus === 'success' ? '✓' : 'Save'}
                        </button>
                        <button type="button" onClick={() => setAddMoneyId(null)} className="px-4 py-3 text-on-surface-variant border border-outline-variant/20 rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors">×</button>
                      </form>
                    )}

                    <div className="mt-auto">
                      <div className="flex items-baseline justify-between mb-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-extrabold tracking-tighter text-on-surface">{fmtEur(mainGoal.current_amount)}</span>
                          <span className="text-on-surface-variant font-medium">/ {fmtEur(mainGoal.target_amount)}</span>
                        </div>
                        <span className="text-2xl font-bold text-primary">{pctOf(mainGoal).toFixed(1)}%</span>
                      </div>
                      <div className="h-4 w-full bg-surface-container rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-700"
                          style={{ width: `${pctOf(mainGoal)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-outline-variant/10">
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Current Savings</p>
                        <p className="text-lg font-bold">{fmtEur(mainGoal.current_amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Progress</p>
                        <p className="text-lg font-bold text-secondary">{pctOf(mainGoal).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Remaining</p>
                        <p className="text-lg font-bold text-on-surface/50">{fmtEur(Math.max(0, mainGoal.target_amount - mainGoal.current_amount))}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-20">
                    <span className="material-symbols-outlined text-on-surface-variant/30 mb-4" style={{ fontSize: '48px' }}>savings</span>
                    <p className="text-sm font-bold text-on-surface-variant mb-1">No Goals Yet</p>
                    <p className="text-sm text-on-surface-variant/60">Click "Add New Aspiration" to begin</p>
                  </div>
                )}
              </div>

              {/* ── Secondary Goal Card ── */}
              {restGoals[0] ? (
                <div key={restGoals[0].id} className="col-span-12 lg:col-span-4 bg-surface-container-lowest rounded-[2rem] p-8 border border-outline-variant/10 flex flex-col shadow-sm group">
                  <div className="flex justify-between items-start mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">star</span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setAddMoneyId(addMoneyId === restGoals[0].id ? null : restGoals[0].id); setAddAmount('') }}
                        className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-widest border border-primary/20 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>add</span>
                        Add
                      </button>
                      <button
                        onClick={() => handleDelete(restGoals[0].id)}
                        className="p-1 text-on-surface-variant hover:text-tertiary transition-colors"
                        title="Delete goal"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                      </button>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-1">{restGoals[0].name}</h3>
                  <p className="text-on-surface-variant text-sm mb-8">Savings Goal</p>

                  {addMoneyId === restGoals[0].id && (
                    <form onSubmit={e => handleAddMoney(e, restGoals[0].id)} className="flex gap-2 mb-6 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Amount (€)</label>
                        <input
                          type="number" min="0" step="any" autoFocus
                          className="w-full bg-surface-container-low border-none rounded-xl py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary/20"
                          placeholder="0.00"
                          value={addAmount}
                          onChange={e => setAddAmount(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" disabled={addStatus === 'loading'} className="px-4 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs disabled:opacity-50">
                        {addStatus === 'success' ? '✓' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setAddMoneyId(null)} className="px-3 py-2.5 text-on-surface-variant border border-outline-variant/20 rounded-xl text-xs font-semibold">×</button>
                    </form>
                  )}

                  <div className="mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-bold">{pctOf(restGoals[0]).toFixed(1)}% Complete</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-primary-container rounded-full transition-all duration-700" style={{ width: `${pctOf(restGoals[0])}%` }} />
                    </div>
                  </div>
                  <div className="space-y-3 mt-auto">
                    <div className="flex justify-between items-center py-3 border-b border-outline-variant/5">
                      <span className="text-sm text-on-surface-variant">Saved</span>
                      <span className="font-bold">{fmtEur(restGoals[0].current_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-on-surface-variant">Goal</span>
                      <span className="font-bold">{fmtEur(restGoals[0].target_amount)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty add card */
                <div
                  onClick={() => setShowForm(true)}
                  className="col-span-12 lg:col-span-4 border-2 border-dashed border-outline-variant/30 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center hover:bg-surface-container-low/50 hover:border-primary/30 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-on-surface-variant">add_circle</span>
                  </div>
                  <h4 className="text-xl font-bold text-on-surface mb-1">New Aspiration</h4>
                  <p className="text-on-surface-variant text-sm px-6">What is the next chapter of your financial story?</p>
                </div>
              )}

              {/* ── Additional Small Goal Cards ── */}
              {restGoals.slice(1).map(goal => (
                <div key={goal.id} className="col-span-12 md:col-span-6 lg:col-span-4 bg-surface-container-low rounded-[2rem] p-8 flex flex-col group">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>savings</span>
                    </div>
                    <h4 className="font-bold text-xl">{goal.name}</h4>
                  </div>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-3xl font-extrabold">{fmtEur(goal.current_amount)}</span>
                    <span className="text-on-surface-variant text-sm">of {fmtEur(goal.target_amount)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-secondary transition-all duration-700" style={{ width: `${pctOf(goal)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">
                    <span>{pctOf(goal) >= 100 ? 'COMPLETE' : pctOf(goal) >= 75 ? 'FINAL PHASE' : 'ON TRACK'}</span>
                    <span className="text-secondary">{pctOf(goal).toFixed(1)}%</span>
                  </div>

                  {addMoneyId === goal.id && (
                    <form onSubmit={e => handleAddMoney(e, goal.id)} className="flex gap-2 mb-4 items-end">
                      <div className="flex-1 space-y-1">
                        <input
                          type="number" min="0" step="any" autoFocus
                          className="w-full bg-surface-container-lowest border-none rounded-xl py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary/20"
                          placeholder="Amount (€)"
                          value={addAmount}
                          onChange={e => setAddAmount(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" disabled={addStatus === 'loading'} className="px-3 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs disabled:opacity-50">
                        {addStatus === 'success' ? '✓' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setAddMoneyId(null)} className="px-2.5 py-2.5 text-on-surface-variant border border-outline-variant/20 rounded-xl text-xs">×</button>
                    </form>
                  )}

                  <div className="flex gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setAddMoneyId(addMoneyId === goal.id ? null : goal.id); setAddAmount('') }}
                      className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border border-primary/20 text-primary hover:bg-primary/5 rounded-xl transition-colors"
                    >
                      Add Money
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-2 text-on-surface-variant hover:text-tertiary border border-outline-variant/20 hover:border-tertiary/20 rounded-xl transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* ── Add new card (always shown when there are restGoals) ── */}
              {restGoals.length > 0 && (
                <div
                  onClick={() => setShowForm(true)}
                  className="col-span-12 md:col-span-6 lg:col-span-4 border-2 border-dashed border-outline-variant/30 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center hover:bg-surface-container-low/50 hover:border-primary/30 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-on-surface-variant">add_circle</span>
                  </div>
                  <h4 className="text-xl font-bold text-on-surface mb-1">New Aspiration</h4>
                  <p className="text-on-surface-variant text-sm px-6">What is the next chapter of your financial story?</p>
                </div>
              )}
            </div>
          )}

          {/* ── Savings Velocity Summary ── */}
          <section className="bg-surface-container-lowest rounded-[2rem] p-10 border border-outline-variant/10 shadow-sm whisper-graph">
            <div className="flex items-start gap-12 flex-col lg:flex-row">
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-4">Savings Velocity</h3>
                <p className="text-on-surface-variant mb-8 leading-relaxed">
                  {goals.length > 0
                    ? `You have ${goals.length} active goal${goals.length > 1 ? 's' : ''} with an overall completion rate of ${overallPct}%. Keep adding to your goals to accelerate your trajectory.`
                    : 'Create savings goals to track your capital velocity and monitor your progress over time.'}
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                  >
                    Add New Goal
                  </button>
                  <button
                    onClick={() => onNavigate('portfolio')}
                    className="bg-surface-container text-on-surface px-6 py-3 rounded-xl font-bold text-sm transition-all hover:bg-surface-container-high active:scale-95"
                  >
                    View Portfolio
                  </button>
                </div>
              </div>
              <div className="w-full lg:w-64 flex flex-col gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-outline-variant/5">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Total Saved</p>
                  <p className="text-3xl font-extrabold tracking-tighter">{fmtEur(totalSaved)}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-outline-variant/5">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Overall Progress</p>
                  <p className="text-3xl font-extrabold tracking-tighter text-secondary">{overallPct}%</p>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* ── Footer ── */}
        <footer className="py-8 px-10 flex flex-col items-center gap-3 border-t border-outline-variant/20 mt-auto bg-surface">
          <div className="flex gap-8">
            <a className="text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors font-semibold" href="#">Terms</a>
            <a className="text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors font-semibold" href="#">Privacy</a>
            <a className="text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors font-semibold" href="#">Compliance</a>
            <a className="text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors font-semibold" href="#">Contact</a>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">© FinanceOS. All rights reserved.</p>
        </footer>

      </main>
    </div>
  )
}
