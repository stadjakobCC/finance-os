import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

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

// ── Price fetching ────────────────────────────────────────────────────────────

async function fetchAllPrices() {
  const result = { bitcoin: null, ethereum: null, solana: null, gold: null, silver: null, usd: null, cash_eur: 1, cash_tr: 1 }

  // 1. CoinGecko for crypto (free, no key, CORS-ok)
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=eur',
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      result.bitcoin  = data.bitcoin?.eur  ?? null
      result.ethereum = data.ethereum?.eur ?? null
      result.solana   = data.solana?.eur   ?? null
    }
  } catch (e) { console.warn('[prices] CoinGecko failed:', e.message) }

  // 2. Frankfurter.app for USD/EUR (free, no key, CORS-ok)
  let usdToEur = null
  try {
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=EUR',
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      usdToEur = data.rates?.EUR ?? null
      result.usd = usdToEur
      result._usdToEur = usdToEur  // store for currency toggle conversions
    }
  } catch (e) { console.warn('[prices] Frankfurter USD failed:', e.message) }

  // 3. gold-api.com for gold/silver in USD → convert to EUR
  // Free, no API key, CORS-open (Access-Control-Allow-Origin: *)
  try {
    const [goldRes, silverRes] = await Promise.all([
      fetch('https://api.gold-api.com/price/XAU', { signal: AbortSignal.timeout(8000) }),
      fetch('https://api.gold-api.com/price/XAG', { signal: AbortSignal.timeout(8000) }),
    ])
    if (goldRes.ok && silverRes.ok) {
      const goldData   = await goldRes.json()
      const silverData = await silverRes.json()
      // Response: { name: "Gold", price: 1842.10, symbol: "XAU", updatedAt: "..." }
      const goldUsd   = goldData.price   ?? null
      const silverUsd = silverData.price ?? null
      console.log('[prices] gold-api.com — XAU:', goldUsd, 'USD, XAG:', silverUsd, 'USD')
      if (usdToEur) {
        result.gold   = goldUsd   !== null ? goldUsd   * usdToEur : null
        result.silver = silverUsd !== null ? silverUsd * usdToEur : null
      }
      // Also store raw USD prices for the currency toggle
      result._goldUsd   = goldUsd
      result._silverUsd = silverUsd
    }
  } catch (e) { console.warn('[prices] gold-api.com failed:', e.message) }

  return result
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Portfolio({ session, onNavigate }) {
  const userId  = session.user.id
  const initial = session.user.email.charAt(0).toUpperCase()

  const [prices,       setPrices]       = useState({ bitcoin: null, ethereum: null, solana: null, gold: null, silver: null, usd: null, cash_eur: 1, cash_tr: 1 })
  const [pricesLoading, setPricesLoading] = useState(true)
  const [holdings,     setHoldings]     = useState([])
  const [filter,       setFilter]       = useState('all') // 'all' | 'commodities' | 'digital'
  const [showForm,     setShowForm]     = useState(false)
  const [formAsset,    setFormAsset]    = useState('bitcoin')
  const [formQty,      setFormQty]      = useState('')
  const [formPrice,    setFormPrice]    = useState('')
  const [formStatus,   setFormStatus]   = useState(null) // null | 'loading' | 'success' | 'error'
  // Per-row currency: { [assetId]: 'EUR' | 'USD' }
  const [rowCurrency,  setRowCurrency]  = useState({})

  // Load prices and holdings in parallel
  useEffect(() => {
    fetchAllPrices().then(p => { setPrices(p); setPricesLoading(false) })
    loadHoldings()
  }, []) // eslint-disable-line

  async function loadHoldings() {
    const { data, error } = await supabase
      .from('holdings').select('*').eq('user_id', userId)
    if (error) console.error('[holdings] fetch error:', error)
    else setHoldings(data || [])
  }

  // Map holdings by asset_id for quick lookup
  const holdingMap = useMemo(() => {
    const map = {}
    for (const h of holdings) map[h.asset_id] = h
    return map
  }, [holdings])

  // Total portfolio value
  const totalValue = useMemo(() => {
    return ASSETS.reduce((sum, asset) => {
      const h = holdingMap[asset.id]
      const p = prices[asset.id]
      if (!h || !p) return sum
      return sum + h.quantity * p
    }, 0)
  }, [holdingMap, prices])

  // Total purchase cost (for overall P&L)
  const totalCost = useMemo(() => {
    return ASSETS.reduce((sum, asset) => {
      const h = holdingMap[asset.id]
      if (!h) return sum
      return sum + h.quantity * h.purchase_price
    }, 0)
  }, [holdingMap])

  const totalPnl    = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : null

  // Filtered asset list
  const visibleAssets = useMemo(() => {
    if (filter === 'commodities') return ASSETS.filter(a => a.category === 'commodities')
    if (filter === 'digital')     return ASSETS.filter(a => a.category === 'digital')
    if (filter === 'cash')        return ASSETS.filter(a => a.category === 'cash')
    return ASSETS
  }, [filter])

  // Pre-fill form when opening for an existing holding
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

  // Trailing 12 months for performance chart
  const chartMonths = getLast12Months()
  // Static bar heights matching the HTML design (decorative)
  const barHeights = [30, 35, 32, 45, 55, 50, 65, 62, 75, 85, 82, 100]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">

      {/* ── Sidebar (exact from HTML) ── */}
      <aside className="fixed left-0 top-0 h-full flex flex-col py-8 bg-[#1c1b1b] w-64 z-50">
        <div className="px-8 mb-12">
          <h1 className="text-2xl font-serif italic text-[#f2ca50]">FinanceOS</h1>
          <p className="font-sans uppercase tracking-[0.1em] text-[10px] text-gray-500 mt-1">Sovereign Curator</p>
        </div>
        <nav className="flex-1 space-y-2">
          <a
            className="flex items-center gap-4 px-8 py-3 text-gray-500 hover:text-gray-200 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer"
            onClick={() => onNavigate('dashboard')}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Dashboard</span>
          </a>
          <a
            className="flex items-center gap-4 px-8 py-3 text-gray-500 hover:text-gray-200 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer"
            onClick={() => onNavigate('monthly')}
          >
            <span className="material-symbols-outlined">calendar_month</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Monthly Overview</span>
          </a>
          <a className="flex items-center gap-4 px-8 py-3 text-[#f2ca50] border-l-2 border-[#f2ca50] font-bold bg-[#2a2a2a]/50">
            <span className="material-symbols-outlined">account_balance_wallet</span>
            <span className="font-sans uppercase tracking-[0.1em] text-xs">Portfolio</span>
          </a>
          <a className="flex items-center gap-4 px-8 py-3 text-gray-500 hover:text-gray-200 hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer" onClick={() => onNavigate('savings')}>
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
          <div className="pt-6 space-y-2 border-t border-outline-variant/15">
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

      {/* ── Main Content Canvas (exact from HTML) ── */}
      <main className="ml-64 flex-1 flex flex-col min-h-screen">

        {/* ── Top Header (exact from HTML) ── */}
        <header className="flex justify-between items-center w-full px-12 py-6 bg-[#131313]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#99907c]">search</span>
              <input
                className="bg-[#2a2a2a] border-none text-on-surface text-sm pl-10 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-[#f2ca50] transition-all"
                placeholder="Search Assets..."
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
            <div className="flex items-center gap-3 pl-6 border-l border-outline-variant/20">
              <span className="font-sans uppercase tracking-widest text-[10px] text-gray-400">{session.user.email.split('@')[0]}</span>
              <div className="w-10 h-10 bg-[#2a2a2a] flex items-center justify-center border border-[#f2ca50]/20 text-[#f2ca50] font-bold text-sm">
                {initial}
              </div>
            </div>
          </div>
        </header>

        {/* ── Portfolio Content (exact from HTML) ── */}
        <div className="px-12 py-12 max-w-7xl w-full mx-auto">

          {/* ── Header Section ── */}
          <section className="mb-16">
            <div className="flex flex-col gap-1">
              <span className="font-sans uppercase tracking-[0.2em] text-xs text-[#f2ca50] mb-2">Aggregate Holdings</span>
              <h2 className="text-6xl font-serif italic text-[#f2ca50] leading-tight">
                {pricesLoading ? '—' : fmtEur(totalValue, 2)}
              </h2>
              <div className="flex items-center gap-4 mt-4">
                {totalPnlPct !== null && (
                  <span className={`flex items-center gap-1 font-medium text-sm ${totalPnl >= 0 ? 'text-[#b6d5cb]' : 'text-[#ffb4ab]'}`}>
                    <span className="material-symbols-outlined text-sm">{totalPnl >= 0 ? 'trending_up' : 'trending_down'}</span>
                    {fmtPct(totalPnlPct)} all time
                  </span>
                )}
                <span className="text-gray-500 font-sans uppercase text-[10px] tracking-widest">
                  {pricesLoading ? 'Fetching live prices...' : 'Live prices'}
                </span>
              </div>
            </div>
          </section>

          {/* ── Asset Table ── */}
          <section className="mb-20">
            <div className="mb-8 flex justify-between items-end">
              <h3 className="font-serif italic text-3xl text-on-surface">Primary Assets</h3>
              <div className="flex items-center gap-6">
                {/* Filter tabs */}
                <div className="flex gap-4">
                  {[['all','All Assets'],['commodities','Commodities'],['digital','Digital'],['cash','Cash']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`font-sans uppercase text-[10px] tracking-widest pb-1 transition-colors ${
                        filter === key
                          ? 'text-[#f2ca50] border-b border-[#f2ca50]/50'
                          : 'text-gray-500 hover:text-on-surface'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Add Position button */}
                <button
                  onClick={() => { setFormAsset('bitcoin'); setFormQty(''); setFormPrice(''); setShowForm(s => !s) }}
                  className="flex items-center gap-2 font-sans uppercase text-[10px] tracking-widest text-[#f2ca50] border border-[#f2ca50]/30 px-3 py-1.5 hover:bg-[#f2ca50]/10 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                  Add Position
                </button>
              </div>
            </div>

            {/* Collapsible Add/Edit Form */}
            {showForm && (
              <div className="bg-[#1c1b1b] p-8 mb-8 border-b border-[#4d4635]">
                <h4 className="font-serif italic text-xl mb-6 text-[#f2ca50]">
                  {holdingMap[formAsset] ? 'Update Position' : 'Add Position'}
                </h4>
                <form onSubmit={handleSaveHolding} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                  <div className="space-y-2">
                    <label className="font-sans uppercase tracking-[0.15em] text-[0.7rem] font-semibold text-[#d0c5af]">Asset</label>
                    <select
                      className="w-full bg-transparent border-b border-[#99907c] focus:border-[#f2ca50] text-sm py-2 appearance-none focus:outline-none text-on-surface"
                      value={formAsset}
                      onChange={e => {
                        setFormAsset(e.target.value)
                        const h = holdingMap[e.target.value]
                        setFormQty(h ? String(h.quantity) : '')
                        setFormPrice(h ? String(h.purchase_price) : '')
                      }}
                    >
                      {ASSETS.map(a => <option key={a.id} value={a.id} className="bg-[#2a2a2a]">{a.label} ({a.ticker})</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="font-sans uppercase tracking-[0.15em] text-[0.7rem] font-semibold text-[#d0c5af]">
                      {['cash_eur', 'cash_tr'].includes(formAsset) ? 'Amount (€)' : 'Quantity'}
                    </label>
                    <input
                      type="number" min="0" step="any"
                      className="w-full bg-transparent border-b border-[#99907c] focus:border-[#f2ca50] text-sm py-2 focus:outline-none text-on-surface"
                      placeholder="0.00"
                      value={formQty}
                      onChange={e => setFormQty(e.target.value)}
                      required
                    />
                  </div>
                  {!['cash_eur', 'cash_tr'].includes(formAsset) && (
                    <div className="space-y-2">
                      <label className="font-sans uppercase tracking-[0.15em] text-[0.7rem] font-semibold text-[#d0c5af]">
                        Avg Purchase Price (€)
                      </label>
                      <input
                        type="number" min="0" step="any"
                        className="w-full bg-transparent border-b border-[#99907c] focus:border-[#f2ca50] text-sm py-2 focus:outline-none text-on-surface"
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
                      className="flex-1 py-2.5 font-sans uppercase tracking-widest text-[10px] font-bold text-[#3c2f00] disabled:opacity-50 transition-opacity"
                      style={{ background: 'linear-gradient(to bottom, #f2ca50, #d4af37)' }}
                    >
                      {formStatus === 'loading' ? '...' : formStatus === 'success' ? '✓ Saved' : formStatus === 'error' ? 'Error' : 'Save'}
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

            {/* Asset Table (exact structure from HTML) */}
            <div className="overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#4d4635]/15">
                    <th className="pb-4 font-sans uppercase text-[10px] tracking-[0.2em] text-gray-500 font-normal">Asset</th>
                    <th className="pb-4 font-sans uppercase text-[10px] tracking-[0.2em] text-gray-500 font-normal text-right">Unit Price</th>
                    <th className="pb-4 font-sans uppercase text-[10px] tracking-[0.2em] text-gray-500 font-normal text-right">Quantity</th>
                    <th className="pb-4 font-sans uppercase text-[10px] tracking-[0.2em] text-gray-500 font-normal text-right">Total Value</th>
                    <th className="pb-4 font-sans uppercase text-[10px] tracking-[0.2em] text-gray-500 font-normal text-right">P &amp; L</th>
                    <th className="pb-4 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#4d4635]/5">
                  {visibleAssets.map(asset => {
                    const holding      = holdingMap[asset.id]
                    const eurPrice     = prices[asset.id]           // always EUR
                    const usdToEur     = prices._usdToEur ?? null
                    const cur          = rowCurrency[asset.id] ?? 'EUR'
                    const isUsd        = cur === 'USD'

                    // Convert EUR price → USD for display if toggled
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

                    return (
                      <tr key={asset.id} className="group hover:bg-[#1c1b1b] transition-colors">
                        {/* Asset name + icon */}
                        <td className="py-6 flex items-center gap-4">
                          {asset.iconStyle === 'gold' ? (
                            <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'linear-gradient(to bottom, #f2ca50, #d4af37)' }}>
                              <span className="material-symbols-outlined text-[#3c2f00]">{asset.icon}</span>
                            </div>
                          ) : asset.iconStyle === 'silver' ? (
                            <div className="w-10 h-10 bg-[#4b4735] flex items-center justify-center">
                              <span className="material-symbols-outlined text-[#bcb59e]">{asset.icon}</span>
                            </div>
                          ) : asset.iconStyle === 'cash' ? (
                            <div className="w-10 h-10 bg-[#1a352f] flex items-center justify-center border border-[#b6d5cb]/20">
                              <span className="material-symbols-outlined text-[#b6d5cb]">{asset.icon}</span>
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-[#2a2a2a] flex items-center justify-center border border-[#f2ca50]/20">
                              <span className="material-symbols-outlined text-[#f2ca50]">{asset.icon}</span>
                            </div>
                          )}
                          <div>
                            <div className="font-serif italic text-xl">{asset.label}</div>
                            <div className="font-sans text-[10px] uppercase text-gray-500 tracking-widest">{asset.ticker}</div>
                          </div>
                        </td>

                        {/* Unit price */}
                        <td className="py-6 text-right font-sans text-sm">
                          {pricesLoading ? (
                            <span className="text-gray-600">—</span>
                          ) : displayPrice !== null ? (
                            fmtMoney(displayPrice, cur, priceDecimals)
                          ) : (
                            <span className="text-gray-600">N/A</span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-6 text-right font-sans text-sm">
                          {holding ? fmtQty(holding.quantity, asset.id) : <span className="text-gray-600">—</span>}
                        </td>

                        {/* Total value */}
                        <td className="py-6 text-right font-sans text-sm font-bold">
                          {displayValue !== null ? fmtMoney(displayValue, cur) : <span className="text-gray-600">—</span>}
                        </td>

                        {/* P&L */}
                        <td className="py-6 text-right">
                          {displayPnl !== null ? (
                            <div>
                              <div className={`text-sm ${isPositive ? 'text-[#b6d5cb]' : 'text-[#ffb4ab]'}`}>
                                {isPositive ? '+' : ''}{fmtMoney(Math.abs(displayPnl), cur)}
                              </div>
                              <div className={`text-[10px] font-sans tracking-widest ${isPositive ? 'text-[#b6d5cb]' : 'text-[#ffb4ab]'}`}>
                                {fmtPct(pnlPct)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-sm">—</span>
                          )}
                        </td>

                        {/* Currency toggle + actions */}
                        <td className="py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* EUR/USD toggle — always visible, subtle */}
                            {usdToEur && (
                              <button
                                onClick={() => setRowCurrency(prev => ({
                                  ...prev,
                                  [asset.id]: prev[asset.id] === 'USD' ? 'EUR' : 'USD',
                                }))}
                                className="flex items-center font-sans text-[8px] tracking-widest border transition-colors"
                                style={{
                                  borderColor: isUsd ? '#f2ca50' : '#4d4635',
                                  color:       isUsd ? '#f2ca50' : '#4d4635',
                                  padding:     '2px 5px',
                                }}
                                title="Toggle currency"
                              >
                                <span style={{ opacity: isUsd ? 0.4 : 1 }}>EUR</span>
                                <span style={{ margin: '0 3px', opacity: 0.3 }}>|</span>
                                <span style={{ opacity: isUsd ? 1 : 0.4 }}>USD</span>
                              </button>
                            )}
                            {/* Edit + delete — appear on row hover */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openForm(asset.id)}
                                className="p-1 text-gray-500 hover:text-[#f2ca50] transition-colors"
                                title="Edit position"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                              </button>
                              {holding && (
                                <button
                                  onClick={() => handleDeleteHolding(asset.id)}
                                  className="p-1 text-gray-500 hover:text-[#ffb4ab] transition-colors"
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
          </section>

          {/* ── Performance History (exact from HTML) ── */}
          <section className="bg-[#1c1b1b] p-12 relative overflow-hidden">
            <div className="flex justify-between items-start mb-12">
              <div>
                <h3 className="font-serif italic text-3xl mb-2">Performance History</h3>
                <p className="font-sans uppercase text-[10px] tracking-widest text-gray-500">Trailing 12 Months Growth</p>
              </div>
              <div className="flex gap-2">
                <button className="w-8 h-8 flex items-center justify-center bg-[#f2ca50] text-[#3c2f00] text-[10px] font-bold">1Y</button>
                <button className="w-8 h-8 flex items-center justify-center border border-[#4d4635]/30 text-gray-500 text-[10px] font-bold hover:border-[#f2ca50] hover:text-[#f2ca50] transition-colors">3Y</button>
                <button className="w-8 h-8 flex items-center justify-center border border-[#4d4635]/30 text-gray-500 text-[10px] font-bold hover:border-[#f2ca50] hover:text-[#f2ca50] transition-colors">ALL</button>
              </div>
            </div>

            {/* Abstract bar chart (exact from HTML — decorative) */}
            <div className="h-64 flex items-end gap-1 w-full">
              {barHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 hover:bg-[#f2ca50]/20 transition-all duration-500"
                  style={{
                    height: `${h}%`,
                    backgroundColor: `rgba(242, 202, 80, ${0.05 + (i / 11) * 0.55})`,
                  }}
                />
              ))}
            </div>

            {/* Month labels (dynamic) */}
            <div className="flex justify-between mt-6 border-t border-[#4d4635]/10 pt-4">
              {[0, 3, 6, 9, 11].map(i => (
                <span
                  key={i}
                  className={`font-sans text-[10px] uppercase tracking-widest ${i === 11 ? 'text-[#f2ca50] font-bold' : 'text-gray-600'}`}
                >
                  {chartMonths[i]}
                </span>
              ))}
            </div>

            {/* Decorative background icon (exact from HTML) */}
            <div className="absolute -right-20 -bottom-20 opacity-5 pointer-events-none">
              <span className="material-symbols-outlined" style={{ fontSize: '300px' }}>query_stats</span>
            </div>
          </section>
        </div>

        {/* ── Footer (exact from HTML) ── */}
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
