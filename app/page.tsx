'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type Signal = 'SELL' | 'BUY' | 'WAIT' | 'CAUTION'

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
}

const SIGNAL_CONFIG = {
  SELL:    { color: '#e84040', bg: 'rgba(232,64,64,0.12)',   border: 'rgba(232,64,64,0.3)',   label: '↓ SELL' },
  BUY:     { color: '#2ecc71', bg: 'rgba(46,204,113,0.12)',  border: 'rgba(46,204,113,0.3)',  label: '↑ BUY' },
  WAIT:    { color: '#f39c12', bg: 'rgba(243,156,18,0.12)',  border: 'rgba(243,156,18,0.3)',  label: '⏸ WAIT' },
  CAUTION: { color: '#e67e22', bg: 'rgba(230,126,34,0.12)', border: 'rgba(230,126,34,0.3)', label: '⚠ CAUTION' },
}

const LOADING_MSGS = [
  'チャートを読み取っています...',
  'EMA配列を解析中...',
  'BOS / CHoCH 検出中...',
  'STAGE POWER 算出中...',
  'エントリーポイント計算中...',
]

export default function Page() {
  const [licenseKey, setLicenseKey] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState('image/png')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const loadingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('bl_license')
    if (saved) {
      setLicenseKey(saved)
      setIsVerified(true)
    }
  }, [])

  const verifyLicense = async () => {
    if (!licenseKey.trim()) return
    setVerifying(true)
    setVerifyError('')
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      })
      const data = await res.json()
      if (data.valid) {
        setIsVerified(true)
        localStorage.setItem('bl_license', licenseKey.trim())
      } else {
        setVerifyError(data.error || '無効なキーです')
      }
    } catch {
      setVerifyError('サーバーエラー')
    } finally {
      setVerifying(false)
    }
  }

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
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const logout = () => {
    localStorage.removeItem('bl_license')
    setIsVerified(false)
    setLicenseKey('')
    reset()
  }

  const cfg = result ? SIGNAL_CONFIG[result.signal] : null

  if (!isVerified) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#f39c12', letterSpacing: '0.2em', marginBottom: 8 }}>BINGO LADDER PRO</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 8, letterSpacing: '0.05em' }}>ANALYZER PRO</div>
          <div style={{ fontSize: 13, color: '#555' }}>ライセンスキーを入力してください</div>
        </div>

        <div style={{ width: '100%', maxWidth: 360 }}>
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && verifyLicense()}
            placeholder="BINGO-XXXX-XXXX"
            style={{
              width: '100%', padding: '14px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12, color: '#fff', fontSize: 16,
              letterSpacing: '0.08em', outline: 'none',
              boxSizing: 'border-box', marginBottom: 12,
            }}
          />
          {verifyError && (
            <div style={{ color: '#e84040', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{verifyError}</div>
          )}
          <button
            onClick={verifyLicense}
            disabled={verifying || !licenseKey.trim()}
            style={{
              width: '100%', padding: '14px',
              background: verifying || !licenseKey.trim() ? 'rgba(255,255,255,0.08)' : '#185FA5',
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 700,
              cursor: verifying || !licenseKey.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {verifying ? '確認中...' : '認証する'}
          </button>
        </div>

        <div style={{ marginTop: 40, fontSize: 11, color: '#333', textAlign: 'center', lineHeight: 1.8 }}>
          ライセンスキーはBINGO LADDER PRO購入時の<br />メールに記載されています
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e8e8e8', paddingBottom: 60 }}>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.15em', marginBottom: 2 }}>BINGO LADDER PRO</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>ANALYZER PRO</div>
          <div style={{ fontSize: 10, color: '#f39c12', marginTop: 1 }}>XAUUSD · Smart Money Fusion</div>
        </div>
        <button onClick={logout} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#666', fontSize: 11, padding: '6px 10px', cursor: 'pointer' }}>
          ログアウト
        </button>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>

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

            <button
              onClick={() => cameraRef.current?.click()}
              style={{
                width: '100%', padding: '14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, color: '#ccc', fontSize: 15,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 20 }}>📷</span> カメラでスキャン
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
          </>
        )}

        {preview && !loading && !result && (
          <div>
            <img src={preview} alt="chart" style={{ width: '100%', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
            <button onClick={analyze} style={{ width: '100%', marginTop: 12, padding: '14px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              ⚡ BINGO LADDER 解析
            </button>
            <button onClick={reset} style={{ width: '100%', marginTop: 8, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#888', fontSize: 13, cursor: 'pointer' }}>
              キャンセル
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#185FA5', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 14, color: '#888' }}>{loadingMsg}</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(232,64,64,0.1)', border: '1px solid rgba(232,64,64,0.25)', borderRadius: 12, padding: '16px', fontSize: 13, color: '#e84040' }}>
            ⚠ {error}
            <button onClick={reset} style={{ display: 'block', marginTop: 10, color: '#888', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer' }}>← 最初からやり直す</button>
          </div>
        )}

        {result && cfg && (
          <div>
            {preview && <img src={preview} alt="chart" style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', maxHeight: 140, objectFit: 'cover', display: 'block', marginBottom: 16 }} />}

            <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 16, padding: '20px', marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: cfg.color, letterSpacing: '0.05em', marginBottom: 4 }}>{cfg.label}</div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>{result.trend}</div>
              {result.currentPrice && <div style={{ fontSize: 12, color: '#666' }}>現在価格: {result.currentPrice}</div>}
            </div>

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
