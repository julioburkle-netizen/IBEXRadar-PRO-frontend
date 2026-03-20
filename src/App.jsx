import React, { useState, useEffect, useCallback, useRef } from 'react'

const BACKEND = 'https://ibexradar-backend.onrender.com'

const SYMBOLS = [
  { id: 'IBEX',   label: 'IBEX 35',  flag: '🇪🇸', ticker: '^IBEX',     group: 'Índices' },
  { id: 'NDX',    label: 'NASDAQ',   flag: '🇺🇸', ticker: '^NDX',      group: 'Índices' },
  { id: 'SPX',    label: 'S&P 500',  flag: '🇺🇸', ticker: '^GSPC',     group: 'Índices' },
  { id: 'DAX',    label: 'DAX',      flag: '🇩🇪', ticker: '^GDAXI',    group: 'Índices' },
  { id: 'EURUSD', label: 'EUR/USD',  flag: '💶',  ticker: 'EURUSD=X',  group: 'Forex'   },
  { id: 'USDCHF', label: 'USD/CHF',  flag: '🇨🇭', ticker: 'USDCHF=X',  group: 'Forex'   },
  { id: 'BTC',    label: 'Bitcoin',  flag: '₿',   ticker: 'BTC-USD',   group: 'Cripto'  },
  { id: 'ETH',    label: 'Ethereum', flag: '🔷',  ticker: 'ETH-USD',   group: 'Cripto'  },
  { id: 'BNB',    label: 'BNB',      flag: '🟡',  ticker: 'BNB-USD',   group: 'Cripto'  },
  { id: 'SOL',    label: 'Solana',   flag: '🟣',  ticker: 'SOL-USD',   group: 'Cripto'  },
  { id: 'XRP',    label: 'XRP',      flag: '🔵',  ticker: 'XRP-USD',   group: 'Cripto'  },
]

const GROUPS = ['Índices', 'Forex', 'Cripto']

const TIMEFRAMES = ['4H', 'Daily', 'Weekly', 'Monthly']
const TF_PARAMS = {
  '4H':     { interval: '1h',  range: '60d' },
  'Daily':  { interval: '1d',  range: '1y'  },
  'Weekly': { interval: '1wk', range: '5y'  },
  'Monthly':{ interval: '1mo', range: '10y' },
}

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
    } else {
      prev = v * k + prev * (1 - k); out[i] = prev
    }
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
  const macd = calcEMA(closes, fast).map((v, i) => {
    const s = calcEMA(closes, slow)[i]
    return v !== null && s !== null ? v - s : null
  })
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

function getColor(value, ind) {
  if (value == null) return '#64748b'
  if (ind === 'STC') return value >= 75 ? '#22c55e' : value <= 25 ? '#ef4444' : '#f59e0b'
  if (ind === 'SMI') return value >= 40 ? '#22c55e' : value <= -40 ? '#ef4444' : '#f59e0b'
  if (ind === 'HARSi') return value >= 60 ? '#22c55e' : value <= 40 ? '#ef4444' : '#f59e0b'
  return '#94a3b8'
}

function getLabel(value, ind) {
  if (value == null) return '—'
  if (ind === 'STC') return value >= 75 ? '▲ ALCISTA' : value <= 25 ? '▼ BAJISTA' : '◆ NEUTRAL'
  if (ind === 'SMI') return value >= 40 ? '▲ SOBRECOMPRA' : value <= -40 ? '▼ SOBREVENTA' : '◆ NEUTRAL'
  if (ind === 'HARSi') return value >= 60 ? '▲ FUERTE' : value <= 40 ? '▼ DÉBIL' : '◆ MODERADO'
  return '—'
}

function Badge({ value, indicator }) {
  const color = getColor(value, indicator)
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, color, background: color + '22', border: `1px solid ${color}44` }}>{getLabel(value, indicator)}</span>
}

function GaugeBar({ value, min, max, color }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return <div style={{ width: '100%', height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: '3px', transition: 'width .5s' }} /></div>
}

function IndicatorCard({ name, value, min, max }) {
  const color = getColor(value, name)
  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{name}</span>
        <Badge value={value} indicator={name} />
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color, marginBottom: '6px', fontVariantNumeric: 'tabular-nums' }}>{value != null ? value.toFixed(1) : '—'}</div>
      {value != null && <GaugeBar value={value} min={min} max={max} color={color} />}
    </div>
  )
}

function Section({ title, icon, children, open: initOpen = true }) {
  const [open, setOpen] = useState(initOpen)
  return (
    <div style={{ marginBottom: '12px' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: open ? '8px 8px 0 0' : '8px', padding: '10px 14px', color: '#f1f5f9', fontSize: '13px', fontWeight: 700 }}>
        <span>{icon} {title}</span><span style={{ color: '#64748b' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ background: '#1e293b', border: '1px solid #334155', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px' }}>{children}</div>}
    </div>
  )
}

export default function App() {
  const [sym, setSym] = useState('IBEX')
  const [tf, setTf] = useState('Daily')
  const [cache, setCache] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)
  const [tgToken, setTgToken] = useState(() => localStorage.getItem('tg_token') || '')
  const [tgChat, setTgChat] = useState(() => localStorage.getItem('tg_chatid') || '')
  const [alertCfg, setAlertCfg] = useState(() => { try { return JSON.parse(localStorage.getItem('alert_config') || '{}') } catch { return {} } })
  const [testStatus, setTestStatus] = useState(null)
  const timer = useRef(null)

  useEffect(() => { localStorage.setItem('tg_token', tgToken) }, [tgToken])
  useEffect(() => { localStorage.setItem('tg_chatid', tgChat) }, [tgChat])
  useEffect(() => { localStorage.setItem('alert_config', JSON.stringify(alertCfg)) }, [alertCfg])

  const fetchData = useCallback(async (symbolId, timeframe) => {
    const s = SYMBOLS.find(x => x.id === symbolId)
    if (!s) return
    const { interval, range } = TF_PARAMS[timeframe]
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${BACKEND}/api/yahoo?ticker=${encodeURIComponent(s.ticker)}&interval=${interval}&range=${range}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const parsed = parseYahoo(await res.json())
      if (!parsed) throw new Error('Sin datos')
      let { closes, highs, lows, volumes, price, priceChange } = parsed
      if (timeframe === '4H') {
        closes = closes.filter((_, i) => i % 4 === 0)
        highs = highs.filter((_, i) => i % 4 === 0)
        lows = lows.filter((_, i) => i % 4 === 0)
        volumes = volumes.filter((_, i) => i % 4 === 0)
      }
      const vc = closes.filter(v => v !== null)
      const vh = highs.filter(v => v !== null)
      const vl = lows.filter(v => v !== null)
      const vv = volumes.filter(v => v !== null)
      setCache(prev => ({
        ...prev,
        [`${symbolId}_${timeframe}`]: {
          STC: calcSTC(vc), SMI: calcSMI(vh, vl, vc),
          HARSi: calcHARSi(vc), volOsc: calcVolumeOsc(vv),
          price, priceChange
        }
      }))
      setLastUpdate(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData(sym, tf)
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => fetchData(sym, tf), 60000)
    return () => clearInterval(timer.current)
  }, [sym, tf, fetchData])

  const cur = cache[`${sym}_${tf}`] || {}
  const activeSym = SYMBOLS.find(s => s.id === sym)

  const sendTest = async () => {
    if (!tgToken || !tgChat) { setTestStatus({ ok: false, msg: 'Rellena Token y Chat ID' }); return }
    setTestStatus({ ok: null, msg: 'Enviando...' })
    try {
      const res = await fetch(`${BACKEND}/api/telegram/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tgToken, chatId: tgChat }) })
      const d = await res.json()
      setTestStatus({ ok: d.ok, msg: d.ok ? '✅ Enviado' : `❌ ${d.error}` })
    } catch { setTestStatus({ ok: false, msg: '❌ Error de conexión' }) }
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', borderBottom: '1px solid #334155', padding: '14px 16px 12px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>📡 IBEXRadar <span style={{ color: '#3b82f6' }}>PRO</span></div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>{lastUpdate ? `Actualizado: ${lastUpdate.toLocaleTimeString('es-ES')}` : 'Cargando...'}{loading && ' ⟳'}</div>
          </div>
          <button onClick={() => fetchData(sym, tf)} disabled={loading} style={{ background: loading ? '#334155' : '#1e3a5f', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '8px', padding: '7px 14px', fontSize: '16px', fontWeight: 700 }}>↻</button>
        </div>
        {['Índices', 'Forex', 'Cripto'].map(group => (
          <div key={group} style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '9px', color: '#475569', fontWeight: 700, letterSpacing: '1px', marginBottom: '3px' }}>{group.toUpperCase()}</div>
            <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
              {SYMBOLS.filter(s => s.group === group).map(s => (
                <button key={s.id} onClick={() => setSym(s.id)} style={{ padding: '4px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', border: 'none', background: sym === s.id ? '#3b82f6' : '#0f172a', color: sym === s.id ? '#fff' : '#94a3b8', boxShadow: sym === s.id ? '0 0 8px #3b82f666' : 'none' }}>{s.flag} {s.label}</button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
          {TIMEFRAMES.map(t => <button key={t} onClick={() => setTf(t)} style={{ flex: 1, padding: '6px 0', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: tf === t ? '1px solid #3b82f6' : '1px solid #334155', background: tf === t ? '#1e3a5f' : 'transparent', color: tf === t ? '#3b82f6' : '#64748b' }}>{t}</button>)}
        </div>
      </div>

      <div style={{ padding: '14px 12px' }}>
        {error && <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#fca5a5', fontSize: '13px' }}>⚠️ {error}</div>}

        {cur.price != null && (
          <div style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)', border: '1px solid #334155', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>{activeSym?.flag} {activeSym?.label} · {tf}</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{cur.price.toLocaleString('es-ES', { maximumFractionDigits: 2 })}</div>
            </div>
            {cur.priceChange != null && <div style={{ fontSize: '16px', fontWeight: 700, color: cur.priceChange >= 0 ? '#22c55e' : '#ef4444', background: (cur.priceChange >= 0 ? '#22c55e' : '#ef4444') + '22', padding: '6px 12px', borderRadius: '8px' }}>{cur.priceChange >= 0 ? '+' : ''}{cur.priceChange.toFixed(2)}%</div>}
          </div>
        )}

        <Section title="Indicadores Técnicos" icon="📊">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <IndicatorCard name="STC" value={cur.STC ?? null} min={0} max={100} />
            <IndicatorCard name="SMI" value={cur.SMI ?? null} min={-100} max={100} />
          </div>
          <IndicatorCard name="HARSi" value={cur.HARSi ?? null} min={0} max={100} />
        </Section>

        <Section title="Oscilador de Volumen" icon="📈" open={false}>
          {cur.volOsc?.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px' }}>
              {cur.volOsc.map((d, i) => { const max = Math.max(...cur.volOsc.map(x => Math.abs(x.value))); const h = max > 0 ? (Math.abs(d.value) / max) * 55 : 0; return <div key={i} style={{ flex: 1, height: `${h}px`, background: d.value >= 0 ? '#22c55e' : '#ef4444', borderRadius: '2px 2px 0 0', minWidth: '4px', alignSelf: 'flex-end', opacity: 0.8 }} /> })}
            </div>
          ) : <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Sin datos</div>}
        </Section>

        <Section title="Alertas Telegram" icon="🔔" open={false}>
          {['BOT TOKEN', 'CHAT ID'].map((label, idx) => (
            <div key={label} style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>{label}</label>
              <input type={idx === 0 ? 'password' : 'text'} value={idx === 0 ? tgToken : tgChat} onChange={e => idx === 0 ? setTgToken(e.target.value) : setTgChat(e.target.value)} placeholder={idx === 0 ? '123456789:ABCdef...' : '-100123456789'} style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }} />
            </div>
          ))}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>ALERTAS POR TIMEFRAME</div>
            {TIMEFRAMES.map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #0f172a' }}>
                <span style={{ minWidth: '48px', fontWeight: 700, fontSize: '12px', color: '#3b82f6', background: '#1e3a5f', padding: '3px 8px', borderRadius: '4px', textAlign: 'center' }}>{t}</span>
                {['STC', 'SMI'].map(ind => <label key={ind} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', cursor: 'pointer' }}><input type="checkbox" checked={alertCfg[t]?.[ind] || false} onChange={e => setAlertCfg(p => ({ ...p, [t]: { ...p[t], [ind]: e.target.checked } }))} style={{ accentColor: '#3b82f6' }} />{ind}</label>)}
              </div>
            ))}
          </div>
          <button onClick={sendTest} style={{ width: '100%', padding: '9px', background: '#1e3a5f', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>🧪 Enviar mensaje de prueba</button>
          {testStatus && <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', background: testStatus.ok === true ? '#14532d' : testStatus.ok === false ? '#450a0a' : '#1e293b', color: testStatus.ok === true ? '#86efac' : testStatus.ok === false ? '#fca5a5' : '#94a3b8' }}>{testStatus.msg}</div>}
        </Section>

        <Section title="Resumen de Señales" icon="🎯" open={false}>
          <div style={{ display: 'grid', gap: '6px' }}>
            {TIMEFRAMES.map(t => { const d = cache[`${sym}_${t}`] || {}; return <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#0f172a', borderRadius: '6px' }}><span style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', minWidth: '48px' }}>{t}</span><div style={{ display: 'flex', gap: '6px' }}><Badge value={d.STC ?? null} indicator="STC" /><Badge value={d.SMI ?? null} indicator="SMI" /></div><button onClick={() => { setTf(t); fetchData(sym, t) }} style={{ background: 'transparent', border: '1px solid #334155', color: '#64748b', borderRadius: '4px', padding: '3px 8px', fontSize: '11px' }}>Ver</button></div> })}
          </div>
          <button onClick={() => TIMEFRAMES.forEach(t => fetchData(sym, t))} style={{ width: '100%', marginTop: '10px', padding: '9px', background: '#1e3a5f', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>↻ Actualizar todos</button>
        </Section>

        <div style={{ textAlign: 'center', color: '#334155', fontSize: '11px', marginTop: '20px' }}>IBEXRadar PRO · Yahoo Finance via ibexradar-backend.onrender.com</div>
      </div>
    </div>
  )
}
