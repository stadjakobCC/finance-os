import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { usePrices } from '../priceContext'

// ── Asset definitions (matches HTML rows exactly) ────────────────────────────

const ASSETS = [
  { id: 'gold',     label: 'Gold',       ticker: 'XAU / EUR', category: 'commodities', icon: 'military_tech',    iconStyle: 'gold'   },
  { id: 'silver',   label: 'Silver',     ticker: 'XAG / EUR', category: 'commodities', icon: 'diamond',          iconStyle: 'silver' },
  { id: 'bitcoin',  label: 'Bitcoin',    ticker: 'BTC / EUR', category: 'digital',     icon: 'currency_bitcoin', iconStyle: 'crypto' },
  { id: 'ethereum', label: 'Ethereum',   ticker: 'ETH / EUR', category: 'digital',     icon: 'token',            iconStyle: 'crypto' },
  { id: 'solana',   label: 'Solana',     ticker: 'SOL / EUR', category: 'digital',     icon: 'deployed_code',    iconStyle: 'crypto' },
  { id: 'usd',      label: 'Cash (USD)', ticker: 'USD / EUR', category: 'cash',        icon: 'payments',         iconStyle: 'cash'   },
  { id: 'cash_eur', label: 'Cash (EUR)', ticker: 'EUR',       category: 'cash',        icon: 'euro',             iconStyle: 'cash'   },
  { id: 'cash_tr',  label: 'Cash (TR)',  ticker: 'EUR',       category: 'cash',        icon: 'euro',             iconStyle: 'cash'   },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(n, decimals = 2) {
  if (n === null || n === undefined) return 'N/A'
  return '€ ' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtUsd(n, decimals = 2) {
  if (n === null || n === undefined) return 'N/A'
  return '$ ' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtMoney(n, currency, decimals = 2) {
  return currency === 'USD' ? fmtUsd(n, decimals) : fmtEur(n, decimals)
}

function fmtQty(n, assetId) {
  if (n === null || n === undefined) return '—'
  const dec = ['bitcoin', 'ethereum', 'solana'].includes(assetId) ? 6
            : ['cash_eur', 'cash_tr', 'usd'].includes(assetId)    ? 2
            : 4
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dec })
}

function fmtPct(n) {
  if (n === null || n === undefined) return null
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

// Trailing 12 month labels for performance chart
function getLast12Months() {
  const now = new Date()
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const labels = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(`${months[d.getMonth()]} ${d.getFullYear()}`)
  }
  return labels
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Portfolio({ session, onNavigate, darkMode, toggleDark }) {
  const userId  = session.user.id
  const initial = session.user.email.charAt(0).toUpperCase()

  const { prices, loading: pricesLoading } = usePrices()
  const [holdings,    setHoldings]    = useState([])
  const [filter,      setFilter]      = useState('all') // 'all' | 'commodities' | 'digital'
  const [showForm,    setShowForm]    = useState(false)
  const [formAsset,   setFormAsset]   = useState('bitcoin')
  const [formQty,     setFormQty]     = useState('')
  const [formPrice,   setFormPrice]   = useState('')
  const [formStatus,  setFormStatus]  = useState(null) // null | 'loading' | 'success' | 'error'
  const [rowCurrency, setRowCurrency] = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    loadHoldings()
  }, []) // eslint-disable-line

  async function loadHoldings() {
    const { data, error } = await supabase
      .from('holdings').select('*').eq('user_id', userId)
    if (error) console.error('[holdings] fetch error:', error)
    else setHoldings(data || [])
  }

  const holdingMap = useMemo(() => {
    const map = {}
    for (const h of holdings) map[h.asset_id] = h
    return map
  }, [holdings])

  const totalValue = useMemo(() => {
    return ASSETS.reduce((sum, asset) => {
      const h = holdingMap[asset.id]
      const p = prices[asset.id]
      if (!h || !p) return sum
      return sum + h.quantity * p
    }, 0)
  }, [holdingMap, prices])

  const totalCost = useMemo(() => {
    return ASSETS.reduce((sum, asset) => {
      const h = holdingMap[asset.id]
      if (!h) return sum
      return sum + h.quantity * h.purchase_price
    }, 0)
  }, [holdingMap])

  const totalPnl    = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : null

  const visibleAssets = useMemo(() => {
    if (filter === 'commodities') return ASSETS.filter(a => a.category === 'commodities')
    if (filter === 'digital')     return ASSETS.filter(a => a.category === 'digital')
    if (filter === 'cash')        return ASSETS.filter(a => a.category === 'cash')
    return ASSETS
  }, [filter])

  function openForm(assetId) {
    const h = holdingMap[assetId]
    setFormAsset(assetId)
    setFormQty(h ? String(h.quantity) : '')
    setFormPrice(h ? String(h.purchase_price) : '')
    setShowForm(true)
  }

  async function handleSaveHolding(e) {
    e.preventDefault()
    setFormStatus('loading')
    const payload = {
      user_id:        userId,
      asset_id:       formAsset,
      quantity:       parseFloat(formQty),
      purchase_price: ['cash_eur', 'cash_tr'].includes(formAsset) ? 1 : parseFloat(formPrice),
    }
    console.log('[holdings] upsert:', payload)
    const { error } = await supabase
      .from('holdings')
      .upsert(payload, { onConflict: 'user_id,asset_id' })
    if (error) {
      console.error('[holdings] upsert error:', error)
      setFormStatus('error')
      setTimeout(() => setFormStatus(null), 3000)
    } else {
      setFormStatus('success')
      loadHoldings()
      setTimeout(() => { setFormStatus(null); setShowForm(false) }, 1500)
    }
  }

  async function handleDeleteHolding(assetId) {
    const { error } = await supabase
      .from('holdings')
      .delete()
      .eq('user_id', userId)
      .eq('asset_id', assetId)
    if (error) console.error('[holdings] delete error:', error)
    else setHoldings(prev => prev.filter(h => h.asset_id !== assetId))
  }

  const chartMonths = getLast12Months()
  const barHeights = [30, 35, 32, 45, 55, 50, 65, 62, 75, 85, 82, 100]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-surface">

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
          <a onClick={() => { setSidebarOpen(false); onNavigate('monthly') }} className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl">
            <span className="material-symbols-outlined">calendar_month</span>
            <span>Overview</span>
          </a>
          <a className="flex items-center gap-3 px-4 py-3 text-blue-600 bg-white/50 rounded-xl shadow-sm font-sans text-sm font-medium tracking-tight cursor-pointer">
            <span className="material-symbols-outlined">account_balance_wallet</span>
            <span>Portfolio</span>
          </a>
          <a onClick={() => { setSidebarOpen(false); onNavigate('savings') }} className="flex items-center gap-3 px-4 py-3 text-slate-500 font-sans text-sm font-medium tracking-tight hover:bg-slate-200/50 transition-all cursor-pointer rounded-xl">
            <span className="material-symbols-outlined">savings</span>
            <span>Savings</span>
          </a>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200/50">
          <button
            onClick={() => { setFormAsset('bitcoin'); setFormQty(''); setFormPrice(''); setShowForm(s => !s) }}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Add Position
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
      <main className="ml-0 md:ml-64 flex-1 flex flex-col min-h-screen">

        {/* ── Header ── */}
        <header className="flex justify-between items-center w-full px-4 md:px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-30 border-b border-outline-variant/20">
          <button
            className="md:hidden p-2 -ml-2 text-on-surface-variant hover:opacity-70 transition-opacity"
            onClick={() => setSidebarOpen(s => !s)}
            aria-label="Open menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
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
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 md:space-y-10 w-full">

          {/* ── Portfolio Hero ── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-surface-container-lowest p-8 rounded-[2rem] shadow-sm border border-outline-variant/10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-semibold mb-1">Aggregate Holdings</p>
                  <h2 className="text-5xl font-extrabold tracking-tighter text-on-surface">
                    {pricesLoading ? '—' : fmtEur(totalValue, 2)}
                  </h2>
                </div>
                <div className="flex flex-col items-end">
                  {totalPnlPct !== null && (
                    <span className={`flex items-center font-bold text-sm px-3 py-1 rounded-full ${totalPnl >= 0 ? 'text-secondary bg-secondary-container/20' : 'text-tertiary bg-tertiary/5'}`}>
                      <span className="material-symbols-outlined text-sm mr-1">{totalPnl >= 0 ? 'trending_up' : 'trending_down'}</span>
                      {fmtPct(totalPnlPct)} all time
                    </span>
                  )}
                  <p className="text-[10px] text-on-surface-variant mt-2 font-medium">
                    {pricesLoading ? 'Fetching live prices...' : 'Live prices'}
                  </p>
                </div>
              </div>
              <div className="h-24 w-full mt-4 relative overflow-hidden rounded-xl">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent"></div>
                <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                  <path d="M0,80 Q50,70 100,50 T200,60 T300,20 T400,30" fill="none" stroke="#0058bc" strokeWidth="2" />
                  <path d="M0,80 Q50,70 100,50 T200,60 T300,20 T400,30 L400,100 L0,100 Z" fill="#0058bc" opacity="0.05" />
                </svg>
              </div>
            </div>

            {/* Allocation Breakdown */}
            <div className="bg-surface-container-low p-4 md:p-8 rounded-[2rem] flex flex-col justify-between border border-outline-variant/10">
              <div>
                <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-semibold mb-4 text-center">Allocation</p>
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="30" fill="none" stroke="#eeedf3" strokeWidth="10" />
                    <circle cx="40" cy="40" r="30" fill="none" stroke="#0058bc" strokeWidth="10"
                      strokeDasharray="188.4" strokeDashoffset="47" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary/40" style={{ fontSize: '28px' }}>pie_chart</span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {[
                    { label: 'Commodities', color: 'bg-primary' },
                    { label: 'Crypto', color: 'bg-secondary-fixed-dim' },
                    { label: 'Cash', color: 'bg-tertiary-fixed-dim' },
                  ].map(item => (
                    <li key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                        <span className="text-xs font-semibold">{item.label}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => { setFormAsset('bitcoin'); setFormQty(''); setFormPrice(''); setShowForm(s => !s) }}
                className="w-full py-2 text-primary text-[11px] font-bold tracking-widest uppercase hover:underline mt-4"
              >
                Add Position
              </button>
            </div>
          </section>

          {/* ── Asset Table ── */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Primary Assets</h3>
              <div className="flex items-center gap-3">
                {/* Filter tabs */}
                <div className="flex gap-2">
                  {[['all','All'],['commodities','Metals'],['digital','Crypto'],['cash','Cash']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        filter === key
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setFormAsset('bitcoin'); setFormQty(''); setFormPrice(''); setShowForm(s => !s) }}
                  className="px-4 py-2 bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface-variant flex items-center gap-2 hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Add
                </button>
              </div>
            </div>

            {/* Collapsible Add/Edit Form */}
            {showForm && (
              <div className="bg-surface-container-lowest rounded-2xl p-8 mb-6 border border-outline-variant/10 shadow-sm">
                <h4 className="text-lg font-bold mb-6 text-on-surface">
                  {holdingMap[formAsset] ? 'Update Position' : 'Add Position'}
                </h4>
                <form onSubmit={handleSaveHolding} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Asset</label>
                    <select
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20"
                      value={formAsset}
                      onChange={e => {
                        setFormAsset(e.target.value)
                        const h = holdingMap[e.target.value]
                        setFormQty(h ? String(h.quantity) : '')
                        setFormPrice(h ? String(h.purchase_price) : '')
                      }}
                    >
                      {ASSETS.map(a => <option key={a.id} value={a.id}>{a.label} ({a.ticker})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">
                      {['cash_eur', 'cash_tr'].includes(formAsset) ? 'Amount (€)' : 'Quantity'}
                    </label>
                    <input
                      type="number" min="0" step="any"
                      className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30"
                      placeholder="0.00"
                      value={formQty}
                      onChange={e => setFormQty(e.target.value)}
                      required
                    />
                  </div>
                  {!['cash_eur', 'cash_tr'].includes(formAsset) && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">
                        Avg Purchase Price (€)
                      </label>
                      <input
                        type="number" min="0" step="any"
                        className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/30"
                        placeholder="0.00"
                        value={formPrice}
                        onChange={e => setFormPrice(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={formStatus === 'loading'}
                      className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
                    >
                      {formStatus === 'loading' ? '...' : formStatus === 'success' ? '✓ Saved' : formStatus === 'error' ? 'Error' : 'Save'}
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

            {/* Asset Table / Cards */}
            <div className="bg-surface-container-lowest rounded-[2rem] overflow-hidden border border-outline-variant/10 shadow-sm">

              {/* ── Mobile asset cards (< md) ── */}
              <div className="md:hidden divide-y divide-surface-container/30">
                {visibleAssets.map(asset => {
                  const holding      = holdingMap[asset.id]
                  const eurPrice     = prices[asset.id]
                  const usdToEur     = prices._usdToEur ?? null
                  const cur          = rowCurrency[asset.id] ?? 'EUR'
                  const isUsd        = cur === 'USD'
                  const displayPrice = eurPrice != null ? (isUsd && usdToEur ? eurPrice / usdToEur : eurPrice) : null
                  const currentValueEur = holding && eurPrice ? holding.quantity * eurPrice : null
                  const displayValue    = currentValueEur !== null ? (isUsd && usdToEur ? currentValueEur / usdToEur : currentValueEur) : null
                  const purchaseValEur  = holding ? holding.quantity * holding.purchase_price : null
                  const pnlEur          = currentValueEur !== null && purchaseValEur !== null ? currentValueEur - purchaseValEur : null
                  const pnlPct          = purchaseValEur ? (pnlEur / purchaseValEur) * 100 : null
                  const isPositive      = pnlEur !== null && pnlEur >= 0
                  const priceDecimals   = displayPrice !== null && displayPrice < 1 ? 4 : 2
                  const iconClass = asset.iconStyle === 'gold' ? 'bg-orange-100 text-orange-600'
                    : asset.iconStyle === 'silver' ? 'bg-surface-container-high text-on-surface-variant'
                    : asset.iconStyle === 'cash'   ? 'bg-secondary-container/20 text-on-secondary-container'
                    : 'bg-primary-fixed/30 text-primary'
                  return (
                    <div key={asset.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}>
                            <span className="material-symbols-outlined">{asset.icon}</span>
                          </div>
                          <div>
                            <p className="font-bold text-sm">{asset.label}</p>
                            <p className="text-[10px] text-on-surface-variant font-medium">{asset.ticker}</p>
                          </div>
                        </div>
                        {pnlPct !== null && (
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isPositive ? 'text-secondary bg-secondary-container/10' : 'text-tertiary bg-tertiary/5'}`}>
                            {fmtPct(pnlPct)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-0.5">Price</p>
                          <p className="text-xs font-bold">{pricesLoading ? '—' : displayPrice !== null ? fmtMoney(displayPrice, cur, priceDecimals) : <span className="text-on-surface-variant/40">N/A</span>}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-0.5">Qty</p>
                          <p className="text-xs font-bold">{holding ? fmtQty(holding.quantity, asset.id) : <span className="text-on-surface-variant/40">—</span>}</p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-0.5">Value</p>
                          <p className="text-xs font-bold">{displayValue !== null ? fmtMoney(displayValue, cur) : <span className="text-on-surface-variant/40">—</span>}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openForm(asset.id)} className="flex-1 py-2.5 text-xs font-semibold border border-outline-variant/20 text-on-surface-variant rounded-xl hover:bg-surface-container transition-colors">Edit</button>
                        {holding && (
                          <button onClick={() => handleDeleteHolding(asset.id)} className="px-4 py-2.5 text-xs font-semibold border border-tertiary/20 text-tertiary rounded-xl hover:bg-tertiary/5 transition-colors">Delete</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── Desktop table (≥ md) ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[640px] text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Asset</th>
                      <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right">Unit Price</th>
                      <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right">Quantity</th>
                      <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right">Total Value</th>
                      <th className="px-8 py-5 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant text-right">P &amp; L</th>
                      <th className="px-8 py-5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container/30">
                    {visibleAssets.map(asset => {
                      const holding      = holdingMap[asset.id]
                      const eurPrice     = prices[asset.id]
                      const usdToEur     = prices._usdToEur ?? null
                      const cur          = rowCurrency[asset.id] ?? 'EUR'
                      const isUsd        = cur === 'USD'

                      const displayPrice = eurPrice !== null && eurPrice !== undefined
                        ? (isUsd && usdToEur ? eurPrice / usdToEur : eurPrice)
                        : null

                      const currentValueEur = holding && eurPrice ? holding.quantity * eurPrice : null
                      const displayValue    = currentValueEur !== null
                        ? (isUsd && usdToEur ? currentValueEur / usdToEur : currentValueEur)
                        : null

                      const purchaseValEur = holding ? holding.quantity * holding.purchase_price : null
                      const pnlEur         = currentValueEur !== null && purchaseValEur !== null
                        ? currentValueEur - purchaseValEur : null
                      const displayPnl     = pnlEur !== null
                        ? (isUsd && usdToEur ? pnlEur / usdToEur : pnlEur)
                        : null
                      const pnlPct         = purchaseValEur ? (pnlEur / purchaseValEur) * 100 : null
                      const isPositive     = pnlEur !== null && pnlEur >= 0

                      const priceDecimals  = displayPrice !== null && displayPrice < 1 ? 4 : 2

                      // Icon styles by asset type
                      const iconClass = asset.iconStyle === 'gold'
                        ? 'bg-orange-100 text-orange-600'
                        : asset.iconStyle === 'silver'
                        ? 'bg-surface-container-high text-on-surface-variant'
                        : asset.iconStyle === 'cash'
                        ? 'bg-secondary-container/20 text-on-secondary-container'
                        : 'bg-primary-fixed/30 text-primary' // crypto

                      return (
                        <tr key={asset.id} className="group hover:bg-surface-container-low/20 transition-colors">
                          {/* Asset name + icon */}
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClass}`}>
                                <span className="material-symbols-outlined">{asset.icon}</span>
                              </div>
                              <div>
                                <p className="font-bold text-sm">{asset.label}</p>
                                <p className="text-[10px] text-on-surface-variant font-medium">{asset.ticker}</p>
                              </div>
                            </div>
                          </td>

                          {/* Unit price */}
                          <td className="px-8 py-6 text-right">
                            <p className="font-bold text-sm">
                              {pricesLoading ? (
                                <span className="text-on-surface-variant/40">—</span>
                              ) : displayPrice !== null ? (
                                fmtMoney(displayPrice, cur, priceDecimals)
                              ) : (
                                <span className="text-on-surface-variant/40">N/A</span>
                              )}
                            </p>
                          </td>

                          {/* Quantity */}
                          <td className="px-8 py-6 text-right">
                            <p className="font-bold text-sm">
                              {holding ? fmtQty(holding.quantity, asset.id) : <span className="text-on-surface-variant/40">—</span>}
                            </p>
                          </td>

                          {/* Total value */}
                          <td className="px-8 py-6 text-right">
                            <p className="font-bold text-sm">
                              {displayValue !== null ? fmtMoney(displayValue, cur) : <span className="text-on-surface-variant/40">—</span>}
                            </p>
                          </td>

                          {/* P&L */}
                          <td className="px-8 py-6 text-right">
                            {displayPnl !== null ? (
                              <div>
                                <div className={`text-sm font-bold ${isPositive ? 'text-secondary' : 'text-tertiary'}`}>
                                  {isPositive ? '+' : ''}{fmtMoney(Math.abs(displayPnl), cur)}
                                </div>
                                <div className={`text-[10px] font-semibold ${isPositive ? 'text-secondary' : 'text-tertiary'} ${isPositive ? 'bg-secondary-container/10' : 'bg-tertiary-container/10'} px-2 py-0.5 rounded-lg inline-block mt-0.5`}>
                                  {fmtPct(pnlPct)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-on-surface-variant/40 text-sm">—</span>
                            )}
                          </td>

                          {/* Currency toggle + actions */}
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {usdToEur && (
                                <button
                                  onClick={() => setRowCurrency(prev => ({
                                    ...prev,
                                    [asset.id]: prev[asset.id] === 'USD' ? 'EUR' : 'USD',
                                  }))}
                                  className={`text-[9px] font-bold tracking-widest border rounded-lg px-2 py-0.5 transition-colors ${
                                    isUsd
                                      ? 'border-primary text-primary bg-primary/5'
                                      : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/30'
                                  }`}
                                  title="Toggle currency"
                                >
                                  {isUsd ? 'USD' : 'EUR'}
                                </button>
                              )}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openForm(asset.id)}
                                  className="p-1 text-on-surface-variant hover:text-primary transition-colors rounded-lg"
                                  title="Edit position"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                                </button>
                                {holding && (
                                  <button
                                    onClick={() => handleDeleteHolding(asset.id)}
                                    className="p-1 text-on-surface-variant hover:text-tertiary transition-colors rounded-lg"
                                    title="Remove position"
                                  >
                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bg-surface-container-low/30 px-4 md:px-8 py-4 flex justify-between items-center">
                <p className="text-[10px] text-on-surface-variant font-semibold">Showing {visibleAssets.length} of {ASSETS.length} assets</p>
                <button className="text-xs font-bold text-primary hover:underline">View Full Report</button>
              </div>
            </div>
          </section>

          {/* ── Performance History ── */}
          <section className="bg-surface-container-lowest rounded-[2rem] p-4 md:p-10 overflow-hidden border border-outline-variant/10 shadow-sm">
            <div className="flex justify-between items-start mb-6 md:mb-10">
              <div>
                <h3 className="text-2xl font-bold mb-1">Performance History</h3>
                <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-widest">Trailing 12 Months Growth</p>
              </div>
              <div className="flex gap-2">
                <button className="w-10 h-8 flex items-center justify-center bg-primary text-on-primary text-[10px] font-bold rounded-xl">1Y</button>
                <button className="w-10 h-8 flex items-center justify-center border border-outline-variant/30 text-on-surface-variant text-[10px] font-bold rounded-xl hover:border-primary/30 hover:text-primary transition-colors">3Y</button>
                <button className="w-10 h-8 flex items-center justify-center border border-outline-variant/30 text-on-surface-variant text-[10px] font-bold rounded-xl hover:border-primary/30 hover:text-primary transition-colors">ALL</button>
              </div>
            </div>

            {/* Decorative bar chart */}
            <div className="h-32 md:h-48 flex items-end gap-1 w-full max-w-full overflow-hidden">
              {barHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 hover:opacity-80 transition-all duration-500 rounded-t-sm"
                  style={{
                    height: `${h}%`,
                    backgroundColor: `rgba(0, 88, 188, ${0.08 + (i / 11) * 0.52})`,
                  }}
                />
              ))}
            </div>

            {/* Month labels */}
            <div className="flex justify-between mt-4 border-t border-outline-variant/10 pt-4">
              {[0, 3, 6, 9, 11].map(i => (
                <span
                  key={i}
                  className={`text-[10px] uppercase tracking-widest font-semibold ${i === 11 ? 'text-primary font-bold' : 'text-on-surface-variant/50'}`}
                >
                  {chartMonths[i]}
                </span>
              ))}
            </div>

            {/* Decorative bg icon */}
            <div className="hidden">
              <span className="material-symbols-outlined" style={{ fontSize: '300px' }}>query_stats</span>
            </div>
          </section>

        </div>

        {/* ── Footer ── */}
        <footer className="mt-10 py-8 px-8 flex items-center justify-center border-t border-outline-variant/20 bg-surface">
          <p className="text-[10px] text-on-surface-variant/50 font-medium">
            Built by Jakob ·{' '}
            <a href="https://github.com/stadjakobCC" target="_blank" rel="noopener noreferrer" className="hover:text-on-surface-variant transition-colors">GitHub</a>
          </p>
        </footer>

      </main>
    </div>
  )
}
