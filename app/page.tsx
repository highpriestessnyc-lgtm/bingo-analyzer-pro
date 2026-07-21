'use client'

import { useState, useRef, useCallback } from 'react'

type Signal = 'SELL' | 'BUY' | 'WAIT' | 'CAUTION'
type Probability = '高' | '中' | '低'

interface Scenario {
  type: string
  label: string
  direction: Signal
  trigger: string
  entry: string
  sl: string
  tp1: string
  tp2: string
  description: string
  probability: Probability
}

interface AnalysisResult {
  signal: Signal
  stage: number
  stagePower: number
  trend: string
  currentPrice: string
  entryZone: string
  slZone: string
  tp1: string
  tp2: string
  tp3: string
  riskReward: string
  reasons: string[]
  warning: string
  confidence: number
  scenarios: Scenario[]
}

const SIGNAL_CONFIG = {
  SELL:    { color: '#e84040', bg: 'rgba(232,64,64,0.12)',   border: 'rgba(232,64,64,0.3)',   label: '↓ SELL' },
  BUY:     { color: '#2ecc71', bg: 'rgba(46,204,113,0.12)',  border: 'rgba(46,204,113,0.3)',  label: '↑ BUY' },
  WAIT:    { color: '#f39c12', bg: 'rgba(243,156,18,0.12)',  border: 'rgba(243,156,18,0.3)',  label: '⏸ WAIT' },
  CAUTION: { color: '#e67e22', bg: 'rgba(230,126,34,0.12)', border: 'rgba(230,126,34,0.3)', label: '⚠ CAUTION' },
}

const PROB_CONFIG: Record<Probability, { color: string; bg: string }> = {
  '高': { color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
  '中': { color: '#f39c12', bg: 'rgba(243,156,18,0.15)' },
  '低': { color: '#e84040', bg: 'rgba(232,64,64,0.15)' },
}

const LOADING_MSGS = [
  'チャートを読み取っています...',
  'EMA配列を解析中...',
  'BOS / CHoCH 検出中...',
  'STAGE POWER 算出中...',
  'シナリオを構築中...',
]

export default function Page() {
  const [preview, setPreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState('image/png')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [lot, setLot] = useState('0.01')
  const [usdJpy, setUsdJpy] = useState('155')
  const [showSimulator, setShowSimulator] = useState(true)
  const [memo, setMemo] = useState('')
  const [showMemo, setShowMemo] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const loadingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const processFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
      setMediaType(file.type || 'image/png')
      setResult(null)
      setError(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const analyze = async () => {
    if (!imageBase64) return
    setLoading(true)
    setError(null)
    setResult(null)
    let idx = 0
    setLoadingMsg(LOADING_MSGS[0])
    loadingRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_MSGS.length
      setLoadingMsg(LOADING_MSGS[idx])
    }, 1200)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '解析失敗')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析エラー')
    } finally {
      if (loadingRef.current) clearInterval(loadingRef.current)
      setLoading(false)
    }
  }

  const reset = () => {
    setPreview(null)
    setImageBase64(null)
    setResult(null)
    setError(null)
    setMemo('')
    setShowMemo(false)
    setCopied(false)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  // CASAシェア用テキスト生成
  const generateShareText = () => {
    if (!result) return ''
    const now = new Date()
    const dateStr = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`
    let text = `📊 XAUUSD 本日の相場 ${dateStr}\n`
    text += `━━━━━━━━━━━━━━\n`
    text += `🎯 ${result.signal} | STAGE ${result.stage} | POWER ${result.stagePower}/10\n`
    text += `📈 ${result.trend}\n\n`
    if (result.scenarios && result.scenarios.length > 0) {
      result.scenarios.forEach(s => {
        const icon = s.direction === 'BUY' ? '🟢' : '🔴'
        text += `【シナリオ${s.type}: ${s.label}】確度${s.probability}\n`
        text += `${icon} ${s.trigger}\n`
        text += `Entry: ${s.entry} | SL: ${s.sl}\n`
        text += `TP1: ${s.tp1} | TP2: ${s.tp2}\n`
        text += `${s.description}\n\n`
      })
    }
    text += `⚠️ ${result.warning}\n`
    text += `━━━━━━━━━━━━━━\n`
    text += `#XAUUSD #GOLD #BINGO_LADDER`
    return text
  }

  const handleCopy = () => {
    const text = generateShareText()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const cfg = result ? SIGNAL_CONFIG[result.signal] : null
  const isBuy = result?.signal === 'BUY'
  const lotNum = parseFloat(lot) || 0.01
  const rate = parseFloat(usdJpy) || 155

  const calcPnL = (entryStr: string, targetStr: string) => {
    const entry = parseFloat(entryStr?.replace(/[^0-9.]/g, '') || '0')
    const target = parseFloat(targetStr?.replace(/[^0-9.]/g, '') || '0')
    if (!entry || !target) return null
    const diff = isBuy ? target - entry : entry - target
    const usd = diff * lotNum * 100
    const jpy = usd * rate
    return {
      usd: Math.abs(usd).toFixed(2),
      jpy: Math.abs(Math.round(jpy)).toLocaleString(),
      positive: usd > 0
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e8e8e8', paddingBottom: 60 }}>
      {/* ヘッダー */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 20px' }}>
        <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.15em', marginBottom: 2 }}>BINGO LADDER PRO</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>ANALYZER PRO</div>
        <div style={{ fontSize: 10, color: '#f39c12', marginTop: 1 }}>XAUUSD · Smart Money Fusion</div>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>

        {/* アップロード */}
        {!preview && !loading && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragOver ? '#f39c12' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 16, padding: '40px 24px', textAlign: 'center',
                cursor: 'pointer', background: dragOver ? 'rgba(243,156,18,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s', marginBottom: 12,
              }}
            >
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 15, color: '#ccc', marginBottom: 4 }}>スクショをドロップ</div>
              <div style={{ fontSize: 12, color: '#666' }}>またはタップして選択</div>
            </div>
            <button onClick={() => cameraRef.current?.click()} style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#ccc', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>📷</span> カメラでスキャン
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
          </>
        )}

        {/* プレビュー */}
        {preview && !loading && !result && (
          <div>
            <img src={preview} alt="chart" style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            <button onClick={analyze} style={{ width: '100%', marginTop: 12, padding: '14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              ⚡ BINGO LADDER 解析
            </button>
            <button onClick={reset} style={{ width: '100%', marginTop: 8, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#888', fontSize: 13, cursor: 'pointer' }}>キャンセル</button>
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#185FA5', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 14, color: '#888' }}>{loadingMsg}</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div style={{ background: 'rgba(232,64,64,0.1)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 12, padding: '16px', fontSize: 13, color: '#e84040' }}>
            ⚠ {error}
            <button onClick={reset} style={{ display: 'block', marginTop: 10, color: '#888', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer' }}>← 最初からやり直す</button>
          </div>
        )}

        {/* 結果 */}
        {result && cfg && (
          <div>
            {preview && <img src={preview} alt="chart" style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', maxHeight: 140, objectFit: 'cover', display: 'block', marginBottom: 16 }} />}

            {/* シグナル */}
            <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 16, padding: '20px', marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: cfg.color, letterSpacing: '0.05em', marginBottom: 4 }}>{cfg.label}</div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>{result.trend}</div>
              {result.currentPrice && <div style={{ fontSize: 12, color: '#666' }}>現在価格: {result.currentPrice}</div>}
            </div>

            {/* ═══ シナリオカード（NEW）═══ */}
            {result.scenarios && result.scenarios.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.1em', marginBottom: 8 }}>🎯 本日のシナリオ</div>
                {result.scenarios.map((s) => {
                  const dirCfg = SIGNAL_CONFIG[s.direction]
                  const probCfg = PROB_CONFIG[s.probability] || PROB_CONFIG['中']
                  return (
                    <div key={s.type} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${dirCfg.border}`,
                      borderLeft: `3px solid ${dirCfg.color}`,
                      borderRadius: 14, padding: '16px', marginBottom: 10
                    }}>
                      {/* ヘッダー */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: dirCfg.color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                            シナリオ{s.type}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.label}</span>
                        </div>
                        <span style={{ background: probCfg.bg, color: probCfg.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
                          確度: {s.probability}
                        </span>
                      </div>

                      {/* トリガー */}
                      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>🔔 トリガー条件</div>
                        <div style={{ fontSize: 14, color: dirCfg.color, fontWeight: 600 }}>{s.trigger}</div>
                      </div>

                      {/* 価格ゾーン */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                        {[
                          { label: 'Entry', value: s.entry, color: dirCfg.color },
                          { label: 'SL', value: s.sl, color: '#e84040' },
                          { label: 'TP1', value: s.tp1, color: '#2ecc71' },
                          { label: 'TP2', value: s.tp2, color: '#27ae60' },
                        ].map(({ label, value, color }) => (
                          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* 解説 */}
                      <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>{s.description}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* CASAシェアボタン（NEW）*/}
            <button
              onClick={handleCopy}
              style={{
                width: '100%', padding: '14px',
                background: copied ? 'rgba(46,204,113,0.2)' : 'rgba(243,156,18,0.15)',
                border: `1px solid ${copied ? 'rgba(46,204,113,0.4)' : 'rgba(243,156,18,0.3)'}`,
                borderRadius: 12, color: copied ? '#2ecc71' : '#f39c12',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                marginBottom: 12, transition: 'all 0.2s'
              }}
            >
              {copied ? '✅ コピーしました！' : '📋 今日の相場テキストをコピー（CASA用）'}
            </button>

            {/* STAGE分析 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.1em', marginBottom: 12 }}>STAGE ANALYSIS</div>
              {[
                { label: `STAGE ${result.stage}`, value: result.stage, max: 5 },
                { label: 'STAGE POWER', value: result.stagePower, max: 10 },
                { label: '信頼度', value: result.confidence, max: 10 },
              ].map(({ label, value, max }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{value}/{max}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: cfg.color, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* エントリーポイント */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.1em', marginBottom: 12 }}>エントリーポイント</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'エントリー', value: result.entryZone, color: cfg.color },
                  { label: 'SL', value: result.slZone, color: '#e84040' },
                  { label: 'TP1', value: result.tp1, color: '#2ecc71' },
                  { label: 'TP2', value: result.tp2, color: '#27ae60' },
                  { label: 'TP3', value: result.tp3, color: '#1e8449' },
                  { label: 'R:R', value: result.riskReward, color: '#3498db' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color }}>{value || '-'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 損益シミュレーター */}
            <div style={{ background: 'rgba(24,95,165,0.1)', border: '1px solid rgba(24,95,165,0.3)', borderRadius: 14, padding: '16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showSimulator ? 12 : 0 }}>
                <div style={{ fontSize: 11, color: '#5ba3e0', letterSpacing: '0.1em' }}>💰 損益シミュレーター</div>
                <button onClick={() => setShowSimulator(!showSimulator)} style={{ background: 'none', border: 'none', color: '#5ba3e0', fontSize: 11, cursor: 'pointer' }}>
                  {showSimulator ? '▲ 閉じる' : '▼ 開く'}
                </button>
              </div>
              {showSimulator && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>LOT数</div>
                      <input type="number" value={lot} onChange={(e) => setLot(e.target.value)} step="0.01" min="0.01" style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>USD/JPY</div>
                      <input type="number" value={usdJpy} onChange={(e) => setUsdJpy(e.target.value)} step="0.1" style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: '🔴 SL 損失', target: result.slZone },
                      { label: '🟢 TP1 利益', target: result.tp1 },
                      { label: '🟢 TP2 利益', target: result.tp2 },
                      { label: '🟢 TP3 利益', target: result.tp3 },
                    ].map(({ label, target }) => {
                      const pnl = calcPnL(result.entryZone, target)
                      if (!pnl) return null
                      const isLoss = label.includes('SL')
                      const color = isLoss ? '#e84040' : '#2ecc71'
                      return (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                          <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color }}>{isLoss ? '-' : '+'}{pnl.usd} USD</div>
                            <div style={{ fontSize: 11, color: '#666' }}>≈ {isLoss ? '-' : '+'}{pnl.jpy} 円</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* メモ */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showMemo ? 10 : 0 }}>
                <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.1em' }}>📝 トレードメモ</div>
                <button onClick={() => setShowMemo(!showMemo)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 11, cursor: 'pointer' }}>{showMemo ? '▲' : '▼ 書く'}</button>
              </div>
              {showMemo && (
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="エントリー理由・注意点・感想など..." rows={3} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#ccc', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              )}
            </div>

            {/* 判定根拠 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.1em', marginBottom: 10 }}>判定根拠</div>
              {result.reasons.map((r, i) => (
                <div key={i} style={{ fontSize: 13, color: '#ccc', padding: '5px 0', borderBottom: i < result.reasons.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', gap: 8 }}>
                  <span style={{ color: cfg.color, flexShrink: 0 }}>•</span><span>{r}</span>
                </div>
              ))}
            </div>

            {result.warning && (
              <div style={{ background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 12, fontSize: 13, color: '#f39c12' }}>
                ⚠ {result.warning}
              </div>
            )}

            <button onClick={reset} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#888', fontSize: 14, cursor: 'pointer' }}>
              ← 別のチャートを解析
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
