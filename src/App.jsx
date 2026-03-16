import React, { useState, useEffect, useCallback, useRef } from 'react'

const BACKEND = 'https://ibexradar-backend.onrender.com'

const SYMBOLS = [
  { id: 'IBEX', label: 'IBEX 35', flag: '🇪🇸' },
  { id: 'NDX', label: 'NASDAQ', flag: '🇺🇸' },
  { id: 'SPX', label: 'S&P 500', flag: '🇺🇸' },
  { id: 'DAX', label: 'DAX', flag: '🇩🇪' },
  { id: 'BTC', label: 'Bitcoin', flag: '₿' },
]

const TIMEFRAMES = ['4H', 'Daily', 'Weekly', 'Monthly']

const TF_LABEL = { '4H': '4H', Daily: '1D', Weekly: '1W', Monthly: '1M' }

function getSignalColor(value, indicator) {
  if (value === null || value === undefined) return '#64748b'
  if (indicator === 'STC') {
    if (value >= 75) return '#22c55e'
    if (value <= 25) return '#ef4444'
    return '#f59e0b'
  }
  if (indicator === 'SMI') {
    if (value >= 40) return '#22c55e'
    if (value <= -40) return '#ef4444'
    return '#f59e0b'
  }
  if (indicator === 'HARSi') {
    if (value >= 60) return '#22c55e'
    if (value <= 40) return '#ef4444'
    return '#f59e0b'
  }
  return '#94a3b8'
}

function getSignalLabel(value, indicator) {
  if (value === null || value === undefined) return '—'
  if (indicator === 'STC') {
    if (value >= 75) return '▲ ALCISTA'
    if (value <= 25) return '▼ BAJISTA'
    return '◆ NEUTRAL'
  }
  if (indicator === 'SMI') {
    if (value >= 40) return '▲ SOBRECOMPRA'
    if (value <= -40) return '▼ SOBREVENTA'
    return '◆ NEUTRAL'
  }
  if (indicator === 'HARSi') {
    if (value >= 60) return '▲ FUERTE'
    if (value <= 40) return '▼ DÉBIL'
    return '◆ MODERADO'
  }
  return '—'
}

function Badge({ value, indicator }) {
  const color = getSignalColor(value, indicator)
  const label = getSignalLabel(value, indicator)
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.5px',
      color: color,
      background: color + '22',
      border: `1px solid ${color}44`
    }}>
      {label}
    </span>
  )
}

function GaugeBar({ value, min, max, color }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return (
    <div style={{ width: '100%', height: '6px', background: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        borderRadius: '3px',
        transition: 'width 0.5s ease'
      }} />
    </div>
  )
}

function IndicatorCard({ name, value, min, max, decimals = 1 }) {
  const color = getSignalColor(value, name)
  const displayVal = value !== null && value !== undefined ? value.toFixed(decimals) : '—'
  return (
    <div style={{
      background: '#0f172a',
      border: `1px solid #334155`,
      borderRadius: '8px',
      padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{name}</span>
        <Badge value={value} indicator={name} />
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color, marginBottom: '6px', fontVariantNumeric: 'tabular-nums' }}>
        {displayVal}
      </div>
      {value !== null && value !== undefined && (
        <GaugeBar value={value} min={min} max={max} color={color} />
      )}
    </div>
  )
}

function CollapsibleSection({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#1e293b', border: '1px solid #334155', borderRadius: open ? '8px 8px 0 0' : '8px',
          padding: '10px 14px', color: '#f1f5f9', fontSize: '13px', fontWeight: 700,
          transition: 'all 0.2s'
        }}
      >
        <span>{icon} {title}</span>
        <span style={{ color: '#64748b', fontSize: '16px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderTop: 'none',
          borderRadius: '0 0 8px 8px', padding: '12px'
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function AlertRow({ tf, config, onChange }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 0', borderBottom: '1px solid #1e293b'
    }}>
      <span style={{
        minWidth: '48px', fontWeight: 700, fontSize: '12px',
        color: '#3b82f6', background: '#1e3a5f', padding: '3px 8px',
        borderRadius: '4px', textAlign: 'center'
      }}>{tf}</span>
      <div style={{ display: 'flex', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
        {['STC', 'SMI'].map(ind => (
          <label key={ind} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config[ind] || false}
              onChange={e => onChange(tf, ind, e.target.checked)}
              style={{ accentColor: '#3b82f6' }}
            />
            {ind}
          </label>
        ))}
      </div>
    </div>
  )
}

function TelegramPanel({ alertConfig, setAlertConfig, telegramToken, setTelegramToken, telegramChatId, setTelegramChatId }) {
  const [testStatus, setTestStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  const sendTest = async () => {
    if (!telegramToken || !telegramChatId) {
      setTestStatus({ ok: false, msg: 'Rellena Token y Chat ID primero' })
      return
    }
    setTestStatus({ ok: null, msg: 'Enviando...' })
    try {
      const res = await fetch(`${BACKEND}/api/telegram/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: telegramToken, chatId: telegramChatId })
      })
      const data = await res.json()
      setTestStatus({ ok: data.ok, msg: data.ok ? '✅ Mensaje enviado correctamente' : `❌ Error: ${data.error || 'desconocido'}` })
    } catch (e) {
      setTestStatus({ ok: false, msg: '❌ No se pudo conectar al backend' })
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      await fetch(`${BACKEND}/api/telegram/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: telegramToken, chatId: telegramChatId, alerts: alertConfig })
      })
      setSaving(false)
      setTestStatus({ ok: true, msg: '✅ Configuración guardada' })
    } catch {
      setSaving(false)
      setTestStatus({ ok: false, msg: '❌ Error al guardar' })
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>BOT TOKEN</label>
        <input
          type="password"
          value={telegramToken}
          onChange={e => setTelegramToken(e.target.value)}
          placeholder="123456789:ABCdef..."
          style={{
            width: '100%', background: '#0f172a', border: '1px solid #334155',
            color: '#f1f5f9', borderRadius: '6px', padding: '8px 10px', fontSize: '13px'
          }}
        />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>CHAT ID</label>
        <input
          type="text"
          value={telegramChatId}
          onChange={e => setTelegramChatId(e.target.value)}
          placeholder="-100123456789"
          style={{
            width: '100%', background: '#0f172a', border: '1px solid #334155',
            color: '#f1f5f9', borderRadius: '6px', padding: '8px 10px', fontSize: '13px'
          }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>ALERTAS POR TIMEFRAME</div>
        {TIMEFRAMES.map(tf => (
          <AlertRow
            key={tf}
            tf={tf}
            config={alertConfig[tf] || {}}
            onChange={(t, ind, val) => setAlertConfig(prev => ({
              ...prev,
              [t]: { ...prev[t], [ind]: val }
            }))}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={sendTest}
          style={{
            flex: 1, padding: '9px', background: '#1e3a5f', border: '1px solid #3b82f6',
            color: '#3b82f6', borderRadius: '6px', fontSize: '12px', fontWeight: 700
          }}
        >
          🧪 TEST
        </button>
        <button
          onClick={saveConfig}
          disabled={saving}
          style={{
            flex: 1, padding: '9px', background: '#3b82f6', border: 'none',
            color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 700
          }}
        >
          {saving ? '...' : '💾 GUARDAR'}
        </button>
      </div>
      {testStatus && (
        <div style={{
          marginTop: '8px', padding: '8px 10px', borderRadius: '6px', fontSize: '12px',
          background: testStatus.ok === true ? '#14532d' : testStatus.ok === false ? '#450a0a' : '#1e293b',
          color: testStatus.ok === true ? '#86efac' : testStatus.ok === false ? '#fca5a5' : '#94a3b8'
        }}>
          {testStatus.msg}
        </div>
      )}
    </div>
  )
}

function VolumeBar({ data }) {
  if (!data || !data.length) return <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Sin datos de volumen</div>
  const max = Math.max(...data.map(d => Math.abs(d.value)))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px', padding: '0 4px' }}>
      {data.slice(-20).map((d, i) => {
        const h = max > 0 ? Math.abs(d.value / max) * 55 : 0
        const color = d.value >= 0 ? '#22c55e' : '#ef4444'
        return (
          <div key={i} style={{
            flex: 1, height: `${h}px`, background: color, borderRadius: '2px 2px 0 0',
            minWidth: '4px', alignSelf: 'flex-end', opacity: 0.8
          }} title={`${d.value?.toFixed(2)}`} />
        )
      })}
    </div>
  )
}

export default function App() {
  const [activeSymbol, setActiveSymbol] = useState('IBEX')
  const [activeTimeframe, setActiveTimeframe] = useState('Daily')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)
  const [telegramToken, setTelegramToken] = useState(() => localStorage.getItem('tg_token') || '')
  const [telegramChatId, setTelegramChatId] = useState(() => localStorage.getItem('tg_chatid') || '')
  const [alertConfig, setAlertConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('alert_config') || '{}') } catch { return {} }
  })
  const intervalRef = useRef(null)

  // Save to localStorage whenever changed
  useEffect(() => { localStorage.setItem('tg_token', telegramToken) }, [telegramToken])
  useEffect(() => { localStorage.setItem('tg_chatid', telegramChatId) }, [telegramChatId])
  useEffect(() => { localStorage.setItem('alert_config', JSON.stringify(alertConfig)) }, [alertConfig])

  const fetchData = useCallback(async (symbol, tf) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND}/api/indicators?symbol=${symbol}&timeframe=${tf}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(prev => ({ ...prev, [`${symbol}_${tf}`]: json }))
      setLastUpdate(new Date())
    } catch (e) {
      setError('No se pudo conectar al backend. Verifica que esté activo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(activeSymbol, activeTimeframe)
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => fetchData(activeSymbol, activeTimeframe), 60000)
    return () => clearInterval(intervalRef.current)
  }, [activeSymbol, activeTimeframe, fetchData])

  const key = `${activeSymbol}_${activeTimeframe}`
  const current = data[key] || {}
  const stc = current.STC ?? null
  const smi = current.SMI ?? null
  const harsi = current.HARSi ?? null
  const volOsc = current.volumeOscillator || []
  const price = current.price ?? null
  const priceChange = current.priceChange ?? null

  const updateTime = lastUpdate
    ? lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', paddingBottom: '40px' }}>
      {/* HEADER */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderBottom: '1px solid #334155',
        padding: '14px 16px 12px',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
              📡 IBEXRadar <span style={{ color: '#3b82f6' }}>PRO</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
              Actualizado: {updateTime} {loading && <span className="pulse">⟳</span>}
            </div>
          </div>
          <button
            onClick={() => fetchData(activeSymbol, activeTimeframe)}
            disabled={loading}
            style={{
              background: loading ? '#334155' : '#1e3a5f',
              border: '1px solid #3b82f6', color: '#3b82f6',
              borderRadius: '8px', padding: '7px 12px', fontSize: '13px', fontWeight: 700
            }}
          >
            {loading ? <span className="spinner" /> : '↻'}
          </button>
        </div>

        {/* SYMBOL SELECTOR */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
          {SYMBOLS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSymbol(s.id)}
              style={{
                padding: '5px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                whiteSpace: 'nowrap', border: 'none',
                background: activeSymbol === s.id ? '#3b82f6' : '#1e293b',
                color: activeSymbol === s.id ? '#fff' : '#94a3b8',
                boxShadow: activeSymbol === s.id ? '0 0 8px #3b82f666' : 'none'
              }}
            >
              {s.flag} {s.label}
            </button>
          ))}
        </div>

        {/* TIMEFRAME TABS */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                border: activeTimeframe === tf ? '1px solid #3b82f6' : '1px solid #334155',
                background: activeTimeframe === tf ? '#1e3a5f' : 'transparent',
                color: activeTimeframe === tf ? '#3b82f6' : '#64748b'
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ padding: '14px 12px' }}>

        {error && (
          <div style={{
            background: '#450a0a', border: '1px solid #ef4444', borderRadius: '8px',
            padding: '10px 14px', marginBottom: '12px', color: '#fca5a5', fontSize: '13px'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* PRICE CARD */}
        {price !== null && (
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '1px solid #334155', borderRadius: '10px',
            padding: '12px 16px', marginBottom: '12px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>
                {SYMBOLS.find(s => s.id === activeSymbol)?.flag} {SYMBOLS.find(s => s.id === activeSymbol)?.label} · {TF_LABEL[activeTimeframe]}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                {price.toLocaleString('es-ES')}
              </div>
            </div>
            {priceChange !== null && (
              <div style={{
                fontSize: '16px', fontWeight: 700,
                color: priceChange >= 0 ? '#22c55e' : '#ef4444',
                background: (priceChange >= 0 ? '#22c55e' : '#ef4444') + '22',
                padding: '6px 12px', borderRadius: '8px'
              }}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            )}
          </div>
        )}

        {/* INDICATORS */}
        <CollapsibleSection title="Indicadores Técnicos" icon="📊">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <IndicatorCard name="STC" value={stc} min={0} max={100} />
            <IndicatorCard name="SMI" value={smi} min={-100} max={100} />
          </div>
          <IndicatorCard name="HARSi" value={harsi} min={0} max={100} />
        </CollapsibleSection>

        {/* VOLUME OSCILLATOR */}
        <CollapsibleSection title="Oscilador de Volumen" icon="📈" defaultOpen={false}>
          {volOsc.length > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Últimas 20 velas</span>
                <span style={{
                  fontSize: '12px', fontWeight: 700,
                  color: volOsc[volOsc.length - 1]?.value >= 0 ? '#22c55e' : '#ef4444'
                }}>
                  {volOsc[volOsc.length - 1]?.value?.toFixed(2)}
                </span>
              </div>
              <VolumeBar data={volOsc} />
            </>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
              Sin datos disponibles
            </div>
          )}
        </CollapsibleSection>

        {/* TELEGRAM ALERTS */}
        <CollapsibleSection title="Alertas Telegram" icon="🔔" defaultOpen={false}>
          <TelegramPanel
            alertConfig={alertConfig}
            setAlertConfig={setAlertConfig}
            telegramToken={telegramToken}
            setTelegramToken={setTelegramToken}
            telegramChatId={telegramChatId}
            setTelegramChatId={setTelegramChatId}
          />
        </CollapsibleSection>

        {/* SIGNAL SUMMARY */}
        <CollapsibleSection title="Resumen de Señales" icon="🎯" defaultOpen={false}>
          <div style={{ display: 'grid', gap: '6px' }}>
            {TIMEFRAMES.map(tf => {
              const d = data[`${activeSymbol}_${tf}`] || {}
              return (
                <div key={tf} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', background: '#0f172a', borderRadius: '6px'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', minWidth: '48px' }}>{tf}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Badge value={d.STC ?? null} indicator="STC" />
                    <Badge value={d.SMI ?? null} indicator="SMI" />
                  </div>
                  <button
                    onClick={() => {
                      setActiveTimeframe(tf)
                      fetchData(activeSymbol, tf)
                    }}
                    style={{
                      background: 'transparent', border: '1px solid #334155',
                      color: '#64748b', borderRadius: '4px', padding: '3px 8px', fontSize: '11px'
                    }}
                  >
                    Ver
                  </button>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => TIMEFRAMES.forEach(tf => fetchData(activeSymbol, tf))}
            style={{
              width: '100%', marginTop: '10px', padding: '9px', background: '#1e3a5f',
              border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '6px',
              fontSize: '12px', fontWeight: 700
            }}
          >
            ↻ Actualizar todos los timeframes
          </button>
        </CollapsibleSection>

        {/* FOOTER */}
        <div style={{ textAlign: 'center', color: '#334155', fontSize: '11px', marginTop: '20px' }}>
          IBEXRadar PRO · Backend: ibexradar-backend.onrender.com
        </div>
      </div>
    </div>
  )
}
