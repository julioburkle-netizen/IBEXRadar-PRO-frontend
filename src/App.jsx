import React, { useState, useEffect, useCallback, useRef } from 'react'

const BACKEND = 'https://ibexradar-backend.onrender.com'

const SYMBOLS = [
  { id: 'IBEX',   label: 'IBEX 35',  flag: '🇪🇸', ticker: '^IBEX',    group: 'Índices' },
  { id: 'NDX',    label: 'NASDAQ',   flag: '🇺🇸', ticker: '^NDX',     group: 'Índices' },
  { id: 'SPX',    label: 'S&P 500',  flag: '🇺🇸', ticker: '^GSPC',    group: 'Índices' },
  { id: 'DAX',    label: 'DAX',      flag: '🇩🇪', ticker: '^GDAXI',   group: 'Índices' },
  { id: 'EURUSD', label: 'EUR/USD',  flag: '💶',  ticker: 'EURUSD=X', group: 'Forex'   },
  { id: 'USDCHF', label: 'USD/CHF',  flag: '🇨🇭', ticker: 'USDCHF=X', group: 'Forex'   },
  { id: 'BTC',    label: 'Bitcoin',  flag: '₿',   ticker: 'BTC-USD',  group: 'Cripto'  },
  { id: 'ETH',    label: 'Ethereum', flag: '🔷',  ticker: 'ETH-USD',  group: 'Cripto'  },
  { id: 'BNB',    label: 'BNB',      flag: '🟡',  ticker: 'BNB-USD',  group: 'Cripto'  },
  { id: 'SOL',    label: 'Solana',   flag: '🟣',  ticker: 'SOL-USD',  group: 'Cripto'  },
  { id: 'XRP',    label: 'XRP',      flag: '🔵',  ticker: 'XRP-USD',  group: 'Cripto'  },
]

const GROUPS = ['Índices', 'Forex', 'Cripto']
const TIMEFRAMES = ['1H', '4H', 'Daily', 'Weekly', 'Monthly']
const TF_PARAMS = {
  '1H':     { interval: '1h',  range: '60d' },
  '4H':     { interval: '1h',  range: '60d' },
  'Daily':  { interval: '1d',  range: '1y'  },
  'Weekly': { interval: '1wk', range: '5y'  },
  'Monthly':{ interval: '1mo', range: '10y' },
}

// ── Math ─────────────────────────────────────────────────────────────────────

function calcEMA(arr, period) {
  const k = 2 / (period + 1)
  const out = new Array(arr.length).fill(null)
  let started = false, prev = 0, sum = 0, cnt = 0
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (v === null || v === undefined || isNaN(v)) continue
    if (!started) {
      sum += v; cnt++
      if (cnt === period) { prev = sum / period; out[i] = prev; started = true }
    } else { prev = v * k + prev * (1 - k); out[i] = prev }
  }
  return out
}

function calcRSI(closes, period = 14) {
  const out = new Array(closes.length).fill(null)
  if (closes.length < period + 1) return out
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  let ag = gains / period, al = losses / period
  for (let i = period; i < closes.length; i++) {
    if (i > period) {
      const d = closes[i] - closes[i - 1]
      ag = (ag * (period - 1) + Math.max(d, 0)) / period
      al = (al * (period - 1) + Math.max(-d, 0)) / period
    }
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al)
  }
  return out
}

function stochastic(arr, period) {
  const out = new Array(arr.length).fill(null)
  for (let i = period - 1; i < arr.length; i++) {
    const slice = arr.slice(i - period + 1, i + 1).filter(v => v !== null)
    if (slice.length < period) continue
    const lo = Math.min(...slice), hi = Math.max(...slice)
    out[i] = hi === lo ? 50 : ((arr[i] - lo) / (hi - lo)) * 100
  }
  return out
}

function calcSTC(closes, fast = 26, slow = 50, cycle = 12, smooth = 0.5) {
  if (closes.length < slow + cycle * 2) return null
  const emaF = calcEMA(closes, fast)
  const emaS = calcEMA(closes, slow)
  const macd = emaF.map((v, i) => v !== null && emaS[i] !== null ? v - emaS[i] : null)
  const st1 = stochastic(macd, cycle)
  const sm1 = new Array(st1.length).fill(null)
  for (let i = 1; i < st1.length; i++) {
    if (st1[i] === null) continue
    sm1[i] = sm1[i-1] === null ? st1[i] : sm1[i-1] + smooth * (st1[i] - sm1[i-1])
  }
  const st2 = stochastic(sm1, cycle)
  const sm2 = new Array(st2.length).fill(null)
  for (let i = 1; i < st2.length; i++) {
    if (st2[i] === null) continue
    sm2[i] = sm2[i-1] === null ? st2[i] : sm2[i-1] + smooth * (st2[i] - sm2[i-1])
  }
  const last = sm2.filter(v => v !== null)
  return last.length ? last[last.length - 1] : null
}

function calcSMI(highs, lows, closes, period = 10, s1 = 3, s2 = 3) {
  if (closes.length < period + s1 + s2) return null
  const mids = [], rngs = []
  for (let i = period - 1; i < closes.length; i++) {
    const hi = Math.max(...highs.slice(i - period + 1, i + 1))
    const lo = Math.min(...lows.slice(i - period + 1, i + 1))
    mids.push(closes[i] - (hi + lo) / 2)
    rngs.push(hi - lo)
  }
  const pad = new Array(period - 1).fill(null)
  const sm2m = calcEMA(calcEMA([...pad, ...mids], s1), s2)
  const sm2r = calcEMA(calcEMA([...pad, ...rngs], s1), s2)
  for (let i = sm2m.length - 1; i >= 0; i--) {
    if (sm2m[i] !== null && sm2r[i] !== null && sm2r[i] !== 0)
      return (sm2m[i] / (sm2r[i] / 2)) * 100
  }
  return null
}

function calcHARSi(closes, period = 14, smooth = 3) {
  const rsi = calcRSI(closes, period)
  const smoothed = calcEMA(rsi, smooth)
  const last = smoothed.filter(v => v !== null)
  return last.length ? last[last.length - 1] : null
}

function calcVolumeOsc(vols, fast = 5, slow = 10) {
  if (!vols || vols.length < slow) return []
  const f = calcEMA(vols, fast), s = calcEMA(vols, slow)
  return f.map((v, i) => v !== null && s[i] !== null ? { value: v - s[i] } : null)
    .filter(Boolean).slice(-20)
}

function parseYahoo(json) {
  try {
    const result = json?.chart?.result?.[0]
    if (!result) return null
    const { timestamp, indicators, meta } = result
    const q = indicators?.quote?.[0]
    if (!q || !timestamp) return null
    const closes = [], highs = [], lows = [], volumes = []
    for (let i = 0; i < timestamp.length; i++) {
      closes.push(q.close?.[i] ?? null)
      highs.push(q.high?.[i] ?? null)
      lows.push(q.low?.[i] ?? null)
      volumes.push(q.volume?.[i] ?? null)
    }
    const price = meta?.regularMarketPrice ?? closes.filter(v => v !== null).at(-1)
    const prev = meta?.previousClose ?? meta?.chartPreviousClose
    return { closes, highs, lows, volumes, price, priceChange: prev ? ((price - prev) / prev) * 100 : null }
  } catch { return null }
}

// ── Signal helpers ────────────────────────────────────────────────────────────

function getSignal(value, ind) {
  if (value == null) return 'neutral'
  if (ind === 'STC') return value >= 75 ? 'bull' : value <= 25 ? 'bear' : 'neutral'
  if (ind === 'SMI') return value >= 40 ? 'bull' : value <= -40 ? 'bear' : 'neutral'
  if (ind === 'HARSi') return value >= 60 ? 'bull' : value <= 40 ? 'bear' : 'neutral'
  return 'neutral'
}

function getColor(value, ind) {
  const sig = getSignal(value, ind)
  return sig === 'bull' ? '#22c55e' : sig === 'bear' ? '#ef4444' : '#f59e0b'
}

function getLabel(value, ind) {
  if (value == null) return '—'
  const sig = getSignal(value, ind)
  if (ind === 'STC') return sig === 'bull' ? '▲ ALCISTA' : sig === 'bear' ? '▼ BAJISTA' : '◆ NEUTRAL'
  if (ind === 'SMI') return sig === 'bull' ? '▲ SOBRECOMPRA' : sig === 'bear' ? '▼ SOBREVENTA' : '◆ NEUTRAL'
  if (ind === 'HARSi') return sig === 'bull' ? '▲ FUERTE' : sig === 'bear' ? '▼ DÉBIL' : '◆ MODERADO'
  return '—'
}

// ── Notifications ─────────────────────────────────────────────────────────────

function sendNotification(title, body) {
  if (Notification?.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png', vibrate: [200, 100, 200] })
  }
}

function checkAlerts(newData, prevData, sym, tf, alertConfig) {
  if (!alertConfig?.enabled) return
  const symLabel = SYMBOLS.find(s => s.id === sym)?.label || sym
  for (const ind of ['STC', 'SMI', 'HARSi']) {
    if (!alertConfig[ind]) continue
    const newVal = newData[ind], prevVal = prevData?.[ind]
    if (newVal == null) continue
    const newSig = getSignal(newVal, ind)
    const prevSig = prevVal != null ? getSignal(prevVal, ind) : null
    if (prevSig && prevSig !== newSig) {
      const e = newSig === 'bull' ? '🟢' : newSig === 'bear' ? '🔴' : '🟡'
      sendNotification(`${e} ${ind} — ${symLabel} ${tf}`, `Señal: ${getLabel(newVal, ind)} (${newVal.toFixed(1)})`)
    }
    if (prevVal != null) {
      if (ind === 'STC') {
        if (prevVal < 75 && newVal >= 75) sendNotification(`🟢 STC ALCISTA — ${symLabel} ${tf}`, `Cruzó 75 → ${newVal.toFixed(1)}`)
        if (prevVal > 25 && newVal <= 25) sendNotification(`🔴 STC BAJISTA — ${symLabel} ${tf}`, `Cruzó 25 → ${newVal.toFixed(1)}`)
      }
      if (ind === 'SMI') {
        if (prevVal < 40 && newVal >= 40) sendNotification(`🟢 SMI SOBRECOMPRA — ${symLabel} ${tf}`, `Cruzó 40 → ${newVal.toFixed(1)}`)
        if (prevVal > -40 && newVal <= -40) sendNotification(`🔴 SMI SOBREVENTA — ${symLabel} ${tf}`, `Cruzó -40 → ${newVal.toFixed(1)}`)
      }
      if (ind === 'HARSi') {
        if (prevVal < 60 && newVal >= 60) sendNotification(`🟢 HARSi FUERTE — ${symLabel} ${tf}`, `Cruzó 60 → ${newVal.toFixed(1)}`)
        if (prevVal > 40 && newVal <= 40) sendNotification(`🔴 HARSi DÉBIL — ${symLabel} ${tf}`, `Cruzó 40 → ${newVal.toFixed(1)}`)
      }
    }
  }
}

// ── UI Components ─────────────────────────────────────────────────────────────

function Badge({ value, indicator }) {
  const color = getColor(value, indicator)
  return (
    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, color, background: color + '22', border: `1px solid ${color}44` }}>
      {getLabel(value, indicator)}
    </span>
  )
}

function GaugeBar({ value, min, max, color }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return (
    <div style={{ width: '100%', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: '4px', transition: 'width .5s' }} />
    </div>
  )
}

function VolumePill({ volStatus, volTrend }) {
  if (volStatus == null) return null
  const positive = volStatus === 'positive'
  const rising = volTrend === 'rising'
  const color = positive ? '#22c55e' : '#ef4444'
  const trendArrow = rising ? '▲' : '▼'
  const label = positive ? 'VOL +' : 'VOL -'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: color + '15', border: `1px solid ${color}44`, marginTop: '10px' }}>
      <span style={{ fontSize: '18px' }}>{positive ? '📈' : '📉'}</span>
      <div>
        <span style={{ fontSize: '13px', fontWeight: 800, color }}>{label}</span>
        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>Oscilador {trendArrow} {rising ? 'creciendo' : 'cayendo'}</span>
      </div>
    </div>
  )
}

function IndicatorCard({ name, value, min, max, volStatus, volTrend }) {
  const color = getColor(value, name)
  const sig = getSignal(value, name)
  // Confirmation logic: signal is confirmed if vol is positive for bull, negative for bear
  const confirmed = sig !== 'neutral' && volStatus != null
    ? (sig === 'bull' && volStatus === 'positive') || (sig === 'bear' && volStatus === 'negative')
    : null

  return (
    <div style={{ background: '#0f172a', border: `1px solid ${value != null ? color + '44' : '#334155'}`, borderRadius: '10px', padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{name}</span>
        <Badge value={value} indicator={name} />
      </div>
      <div style={{ fontSize: '32px', fontWeight: 800, color, marginBottom: '8px', fontVariantNumeric: 'tabular-nums' }}>
        {value != null ? value.toFixed(1) : '—'}
      </div>
      {value != null && <GaugeBar value={value} min={min} max={max} color={color} />}
      {confirmed !== null && (
        <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 700, color: confirmed ? '#22c55e' : '#f59e0b' }}>
          {confirmed ? '✅ CONFIRMADO por volumen' : '⚠️ SIN CONFIRMAR (volumen opuesto)'}
        </div>
      )}
    </div>
  )
}

function Section({ title, icon, children, open: initOpen = true }) {
  const [open, setOpen] = useState(initOpen)
  return (
    <div style={{ marginBottom: '14px' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 16px', color: '#f1f5f9', fontSize: '15px', fontWeight: 700 }}>
        <span>{icon} {title}</span>
        <span style={{ color: '#64748b', fontSize: '14px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function AlertPanel({ alertConfig, setAlertConfig, notifPermission, onRequestPermission }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>Alarmas Android</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Notificaciones nativas en tu móvil</div>
        </div>
        <button onClick={() => setAlertConfig(p => ({ ...p, enabled: !p.enabled }))} style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, border: 'none', background: alertConfig.enabled ? '#22c55e' : '#334155', color: alertConfig.enabled ? '#fff' : '#64748b' }}>
          {alertConfig.enabled ? '✅ ON' : 'OFF'}
        </button>
      </div>

      {notifPermission !== 'granted' && (
        <button onClick={onRequestPermission} style={{ width: '100%', marginBottom: '14px', padding: '12px', borderRadius: '8px', background: '#1e3a5f', border: '1px solid #3b82f6', color: '#3b82f6', fontSize: '14px', fontWeight: 700 }}>
          🔔 Activar notificaciones del sistema
        </button>
      )}
      {notifPermission === 'granted' && (
        <div style={{ background: '#14532d', border: '1px solid #22c55e', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#86efac' }}>
          ✅ Notificaciones activadas
        </div>
      )}

      <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px' }}>AVISAR CUANDO:</div>
      {['STC', 'SMI', 'HARSi'].map(ind => (
        <div key={ind} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #0f172a' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>{ind}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              {ind === 'STC' && 'Cruza 25 o 75 · Cambia señal'}
              {ind === 'SMI' && 'Cruza -40 o 40 · Cambia señal'}
              {ind === 'HARSi' && 'Cruza 40 o 60 · Cambia señal'}
            </div>
          </div>
          <button onClick={() => setAlertConfig(p => ({ ...p, [ind]: !p[ind] }))} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, border: 'none', background: alertConfig[ind] ? '#3b82f6' : '#334155', color: alertConfig[ind] ? '#fff' : '#64748b' }}>
            {alertConfig[ind] ? '✅' : '○'}
          </button>
        </div>
      ))}
      <div style={{ marginTop: '14px', padding: '10px 14px', background: '#0f172a', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
        ℹ️ La app revisa señales cada 5 minutos mientras está abierta.
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [sym, setSym] = useState('IBEX')
  const [tf, setTf] = useState('Daily')
  const [cache, setCache] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)
  const [notifPermission, setNotifPermission] = useState(Notification?.permission || 'default')
  const [alertConfig, setAlertConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('alert_config') || '{"enabled":true,"STC":true,"SMI":true,"HARSi":true}') }
    catch { return { enabled: true, STC: true, SMI: true, HARSi: true } }
  })
  const [tgToken, setTgToken] = useState(() => localStorage.getItem('tg_token') || '')
  const [tgChat, setTgChat] = useState(() => localStorage.getItem('tg_chatid') || '')
  const [testStatus, setTestStatus] = useState(null)
  const timer = useRef(null)
  const prevCache = useRef({})

  useEffect(() => { localStorage.setItem('alert_config', JSON.stringify(alertConfig)) }, [alertConfig])
  useEffect(() => { localStorage.setItem('tg_token', tgToken) }, [tgToken])
  useEffect(() => { localStorage.setItem('tg_chatid', tgChat) }, [tgChat])

  const requestPermission = async () => {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
  }

  const fetchData = useCallback(async (symbolId, timeframe, silent = false) => {
    const s = SYMBOLS.find(x => x.id === symbolId)
    if (!s) return
    const { interval, range } = TF_PARAMS[timeframe]
    if (!silent) { setLoading(true); setError(null) }
    try {
      const res = await fetch(`${BACKEND}/api/yahoo?ticker=${encodeURIComponent(s.ticker)}&interval=${interval}&range=${range}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const parsed = parseYahoo(await res.json())
      if (!parsed) throw new Error('Sin datos de Yahoo Finance')
      let { closes, highs, lows, volumes, price, priceChange } = parsed
      if (timeframe === '4H') {
        closes  = closes.filter((_, i) => i % 4 === 0)
        highs   = highs.filter((_, i) => i % 4 === 0)
        lows    = lows.filter((_, i) => i % 4 === 0)
        volumes = volumes.filter((_, i) => i % 4 === 0)
      }
      const vc = closes.filter(v => v !== null)
      const vh = highs.filter(v => v !== null)
      const vl = lows.filter(v => v !== null)
      const vv = volumes.filter(v => v !== null)
      const volOsc = calcVolumeOsc(vv)
      const lastVol = volOsc.length ? volOsc[volOsc.length - 1]?.value : null
      const prevVol = volOsc.length > 1 ? volOsc[volOsc.length - 2]?.value : null
      const volStatus = lastVol == null ? null : lastVol > 0 ? 'positive' : 'negative'
      const volTrend = lastVol != null && prevVol != null ? (Math.abs(lastVol) > Math.abs(prevVol) ? 'rising' : 'falling') : null
      const newData = {
        STC: calcSTC(vc), SMI: calcSMI(vh, vl, vc), HARSi: calcHARSi(vc),
        volOsc, volStatus, volTrend, price, priceChange
      }
      const key = `${symbolId}_${timeframe}`
      checkAlerts(newData, prevCache.current[key], symbolId, timeframe, alertConfig)
      prevCache.current[key] = newData
      setCache(prev => ({ ...prev, [key]: newData }))
      if (!silent) setLastUpdate(new Date())
    } catch (e) {
      if (!silent) setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [alertConfig])

  useEffect(() => {
    fetchData(sym, tf)
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => fetchData(sym, tf, true), 5 * 60 * 1000)
    return () => clearInterval(timer.current)
  }, [sym, tf, fetchData])

  const cur = cache[`${sym}_${tf}`] || {}
  const activeSym = SYMBOLS.find(s => s.id === sym)

  // Telegram — llamada directa a la API de Telegram (sin pasar por backend)
  const sendTest = async () => {
    if (!tgToken || !tgChat) { setTestStatus({ ok: false, msg: 'Rellena Token y Chat ID' }); return }
    setTestStatus({ ok: null, msg: 'Enviando...' })
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text: '✅ IBEXRadar PRO — Conexión Telegram OK 🚀' })
      })
      const d = await res.json()
      setTestStatus({ ok: d.ok, msg: d.ok ? '✅ Mensaje enviado correctamente' : `❌ ${d.description}` })
    } catch { setTestStatus({ ok: false, msg: '❌ Error de conexión' }) }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', paddingBottom: '40px', fontSize: '16px' }}>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', borderBottom: '1px solid #334155', padding: '16px 16px 12px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9' }}>📡 IBEXRadar <span style={{ color: '#3b82f6' }}>PRO</span></div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {lastUpdate ? `Actualizado: ${lastUpdate.toLocaleTimeString('es-ES')}` : 'Cargando...'}{loading && ' ⟳'}
            </div>
          </div>
          <button onClick={() => fetchData(sym, tf)} disabled={loading} style={{ background: loading ? '#334155' : '#1e3a5f', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '10px', padding: '10px 16px', fontSize: '18px', fontWeight: 700 }}>↻</button>
        </div>

        {GROUPS.map(group => (
          <div key={group} style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '10px', color: '#475569', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>{group.toUpperCase()}</div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              {SYMBOLS.filter(s => s.group === group).map(s => (
                <button key={s.id} onClick={() => setSym(s.id)} style={{ padding: '5px 11px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', border: 'none', background: sym === s.id ? '#3b82f6' : '#0f172a', color: sym === s.id ? '#fff' : '#94a3b8', boxShadow: sym === s.id ? '0 0 8px #3b82f666' : 'none' }}>
                  {s.flag} {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)} style={{ flex: 1, padding: '8px 0', borderRadius: '8px', fontSize: '13px', fontWeight: 700, border: tf === t ? '1px solid #3b82f6' : '1px solid #334155', background: tf === t ? '#1e3a5f' : 'transparent', color: tf === t ? '#3b82f6' : '#64748b' }}>{t}</button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '16px 14px' }}>
        {error && (
          <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', color: '#fca5a5', fontSize: '14px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* PRICE */}
        {cur.price != null && (
          <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #334155', borderRadius: '12px', padding: '16px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>{activeSym?.flag} {activeSym?.label} · {tf}</div>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                {cur.price.toLocaleString('es-ES', { maximumFractionDigits: 4 })}
              </div>
            </div>
            {cur.priceChange != null && (
              <div style={{ fontSize: '18px', fontWeight: 700, color: cur.priceChange >= 0 ? '#22c55e' : '#ef4444', background: (cur.priceChange >= 0 ? '#22c55e' : '#ef4444') + '22', padding: '8px 14px', borderRadius: '10px' }}>
                {cur.priceChange >= 0 ? '+' : ''}{cur.priceChange.toFixed(2)}%
              </div>
            )}
          </div>
        )}

        {/* INDICATORS + VOLUME STATUS */}
        <Section title="Indicadores Técnicos" icon="📊">
          <VolumePill volStatus={cur.volStatus} volTrend={cur.volTrend} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', marginBottom: '10px' }}>
            <IndicatorCard name="STC" value={cur.STC ?? null} min={0} max={100} volStatus={cur.volStatus} volTrend={cur.volTrend} />
            <IndicatorCard name="SMI" value={cur.SMI ?? null} min={-100} max={100} volStatus={cur.volStatus} volTrend={cur.volTrend} />
          </div>
          <IndicatorCard name="HARSi" value={cur.HARSi ?? null} min={0} max={100} volStatus={cur.volStatus} volTrend={cur.volTrend} />

          {/* VOLUME OSCILLATOR BARS */}
          {cur.volOsc?.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>OSCILADOR DE VOLUMEN</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '50px' }}>
                {cur.volOsc.map((d, i) => {
                  const max = Math.max(...cur.volOsc.map(x => Math.abs(x.value)))
                  const h = max > 0 ? (Math.abs(d.value) / max) * 46 : 0
                  return <div key={i} style={{ flex: 1, height: `${h}px`, background: d.value >= 0 ? '#22c55e' : '#ef4444', borderRadius: '2px 2px 0 0', minWidth: '4px', alignSelf: 'flex-end', opacity: 0.8 }} />
                })}
              </div>
            </div>
          )}
        </Section>

        {/* ALARMS */}
        <Section title="Alarmas Android" icon="🔔" open={false}>
          <AlertPanel alertConfig={alertConfig} setAlertConfig={setAlertConfig} notifPermission={notifPermission} onRequestPermission={requestPermission} />
        </Section>

        {/* TELEGRAM */}
        <Section title="Alertas Telegram" icon="✈️" open={false}>
          {['BOT TOKEN', 'CHAT ID'].map((label, idx) => (
            <div key={label} style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '5px', fontWeight: 600 }}>{label}</label>
              <input type={idx === 0 ? 'password' : 'text'} value={idx === 0 ? tgToken : tgChat} onChange={e => idx === 0 ? setTgToken(e.target.value) : setTgChat(e.target.value)} placeholder={idx === 0 ? '123456789:ABCdef...' : '-100123456789'} style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '8px', padding: '10px 12px', fontSize: '14px' }} />
            </div>
          ))}
          <button onClick={sendTest} style={{ width: '100%', padding: '12px', background: '#1e3a5f', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '8px', fontSize: '14px', fontWeight: 700 }}>
            🧪 Enviar mensaje de prueba
          </button>
          {testStatus && (
            <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: testStatus.ok === true ? '#14532d' : testStatus.ok === false ? '#450a0a' : '#1e293b', color: testStatus.ok === true ? '#86efac' : testStatus.ok === false ? '#fca5a5' : '#94a3b8' }}>
              {testStatus.msg}
            </div>
          )}
        </Section>

        {/* SIGNAL SUMMARY */}
        <Section title="Resumen de Señales" icon="🎯" open={false}>
          <div style={{ display: 'grid', gap: '8px' }}>
            {TIMEFRAMES.map(t => {
              const d = cache[`${sym}_${t}`] || {}
              const vol = d.volStatus
              const stcSig = getSignal(d.STC, 'STC')
              const confirmed = stcSig !== 'neutral' && vol != null
                ? (stcSig === 'bull' && vol === 'positive') || (stcSig === 'bear' && vol === 'negative')
                : null
              return (
                <div key={t} style={{ padding: '10px 12px', background: '#0f172a', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6', minWidth: '52px' }}>{t}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Badge value={d.STC ?? null} indicator="STC" />
                      <Badge value={d.SMI ?? null} indicator="SMI" />
                    </div>
                    <button onClick={() => { setTf(t); fetchData(sym, t) }} style={{ background: 'transparent', border: '1px solid #334155', color: '#64748b', borderRadius: '6px', padding: '5px 10px', fontSize: '12px' }}>Ver</button>
                  </div>
                  {confirmed !== null && (
                    <div style={{ fontSize: '11px', marginTop: '4px', color: confirmed ? '#22c55e' : '#f59e0b' }}>
                      {confirmed ? '✅ Vol confirma señal' : '⚠️ Vol no confirma'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={() => TIMEFRAMES.forEach(t => fetchData(sym, t))} style={{ width: '100%', marginTop: '12px', padding: '12px', background: '#1e3a5f', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '8px', fontSize: '14px', fontWeight: 700 }}>
            ↻ Actualizar todos los timeframes
          </button>
        </Section>

        <div style={{ textAlign: 'center', color: '#334155', fontSize: '12px', marginTop: '20px' }}>
          IBEXRadar PRO · Yahoo Finance via ibexradar-backend.onrender.com
        </div>
      </div>
    </div>
  )
}
