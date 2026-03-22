import { createContext, useContext, useState, useEffect } from 'react'

// ── Cache (module-level — survives re-renders, resets on page refresh) ────────
const CACHE_TTL = 10_000 // 10 seconds
const _cache = { data: null, ts: 0, inflight: null }

async function fetchAllPrices() {
  const result = {
    bitcoin: null, ethereum: null, solana: null,
    gold: null, silver: null, usd: null,
    cash_eur: 1, cash_tr: 1,
  }

  // 1. Crypto — CoinGecko first, CryptoCompare as fallback
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=eur',
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
    const d = await res.json()
    result.bitcoin  = d.bitcoin?.eur  ?? null
    result.ethereum = d.ethereum?.eur ?? null
    result.solana   = d.solana?.eur   ?? null
  } catch (e) {
    console.warn('[prices] CoinGecko failed, trying CryptoCompare:', e.message)
    try {
      const res = await fetch(
        'https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC,ETH,SOL&tsyms=EUR',
        { signal: AbortSignal.timeout(8000) }
      )
      if (res.ok) {
        const d = await res.json()
        result.bitcoin  = d.BTC?.EUR ?? null
        result.ethereum = d.ETH?.EUR ?? null
        result.solana   = d.SOL?.EUR ?? null
      }
    } catch (e2) {
      console.warn('[prices] CryptoCompare also failed:', e2.message)
    }
  }

  // 2. USD/EUR rate
  let usdToEur = null
  try {
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=EUR',
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const d = await res.json()
      usdToEur = d.rates?.EUR ?? null
      result.usd = usdToEur
      result._usdToEur = usdToEur
    }
  } catch (e) { console.warn('[prices] Frankfurter:', e.message) }

  // 3. Gold & Silver (USD → EUR)
  try {
    const [gr, sr] = await Promise.all([
      fetch('https://api.gold-api.com/price/XAU', { signal: AbortSignal.timeout(8000) }),
      fetch('https://api.gold-api.com/price/XAG', { signal: AbortSignal.timeout(8000) }),
    ])
    if (gr.ok && sr.ok && usdToEur) {
      const gd = await gr.json()
      const sd = await sr.json()
      result.gold   = gd.price != null ? gd.price * usdToEur : null
      result.silver = sd.price != null ? sd.price * usdToEur : null
      result._goldUsd   = gd.price
      result._silverUsd = sd.price
    }
  } catch (e) { console.warn('[prices] gold-api:', e.message) }

  return result
}

function fetchPricesCached() {
  const now = Date.now()
  if (_cache.data && now - _cache.ts < CACHE_TTL) {
    return Promise.resolve(_cache.data)
  }
  if (_cache.inflight) return _cache.inflight
  _cache.inflight = fetchAllPrices().then(p => {
    _cache.data = p
    _cache.ts = Date.now()
    _cache.inflight = null
    return p
  })
  return _cache.inflight
}

// ── Context ───────────────────────────────────────────────────────────────────

const DEFAULT_PRICES = {
  bitcoin: null, ethereum: null, solana: null,
  gold: null, silver: null, usd: null,
  cash_eur: 1, cash_tr: 1,
}

const PriceContext = createContext({ prices: DEFAULT_PRICES, loading: true })

export function PriceProvider({ children }) {
  const [prices,  setPrices]  = useState(DEFAULT_PRICES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPricesCached().then(p => {
      setPrices(p)
      setLoading(false)
    })
  }, [])

  return (
    <PriceContext.Provider value={{ prices, loading }}>
      {children}
    </PriceContext.Provider>
  )
}

export function usePrices() {
  return useContext(PriceContext)
}
