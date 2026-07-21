import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `あなたはBINGO LADDER PRO v2.0のトレード解析AIです。XAUUSDのTradingViewチャートスクリーンショットを見て、BINGO LADDERロジックに従い分析します。

【BINGO LADDERロジック】
STAGE判定:
- STAGE 0: 完全フラット・EMA全混合・方向感なし（STAGE POWER 0）
- STAGE 1: 微弱トレンド示唆・EMA一部揃い始め（STAGE POWER 1-2）
- STAGE 2: トレンド形成中・EMA2本以上揃う（STAGE POWER 3-4）
- STAGE 3: 明確なトレンド・EMA全揃い（STAGE POWER 5-6）
- STAGE 4: 強いトレンド・価格EMAから大きく乖離（STAGE POWER 7-8）
- STAGE 5: 超強トレンド・エクステンション・過熱（STAGE POWER 9-10）

判定基準:
1. 上位足EMAの向きと配列
2. BOS: 直近高値/安値を明確に割れているか
3. CHoCH: 転換シグナルの有無
4. ボラティリティトレイル（赤い雲）の向きと収縮・拡張
5. BUY/SELLラベルの密度と直近シグナル方向
6. 右側パネルのSTAGE POWER数値・MTFトレンド方向

必ず以下のJSON形式のみで返答（コードブロックなし）:
{
  "signal": "SELL" | "BUY" | "WAIT" | "CAUTION",
  "stage": 0から5の整数,
  "stagePower": 0から10の整数,
  "trend": "下降トレンド" | "上昇トレンド" | "レンジ" | "転換示唆" | "過熱圏",
  "currentPrice": "現在価格（例: 4185.50）",
  "entryZone": "エントリー推奨価格帯",
  "slZone": "SL推奨価格帯",
  "tp1": "TP1価格",
  "tp2": "TP2価格",
  "tp3": "TP3価格",
  "riskReward": "リスクリワード比（例: 1:2.5）",
  "reasons": ["根拠1", "根拠2", "根拠3"],
  "warning": "注意点",
  "confidence": 1から10の整数,
  "scenarios": [
    {
      "type": "A",
      "label": "メインシナリオ",
      "direction": "SELL" | "BUY",
      "trigger": "〇〇を下抜けたら" | "〇〇まで戻りを待って" | "〇〇を上抜けたら" など具体的なトリガー条件,
      "entry": "エントリー価格（例: 4200.00）",
      "sl": "SL価格",
      "tp1": "TP1価格",
      "tp2": "TP2価格",
      "description": "このシナリオの解説（1〜2文で簡潔に）",
      "probability": "高" | "中" | "低"
    },
    {
      "type": "B",
      "label": "サブシナリオ",
      "direction": "SELL" | "BUY",
      "trigger": "具体的なトリガー条件",
      "entry": "エントリー価格",
      "sl": "SL価格",
      "tp1": "TP1価格",
      "tp2": "TP2価格",
      "description": "このシナリオの解説",
      "probability": "高" | "中" | "低"
    }
  ]
}`

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: '画像データなし' }, { status: 400 })
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'APIキー未設定' }, { status: 500 })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: imageBase64 } },
            { type: 'text', text: 'このXAUUSDチャートをBINGO LADDER PROロジックで解析し、具体的なシナリオA・Bを含めて出力してください。' }
          ]
        }]
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `API エラー: ${response.status}`, detail: err }, { status: 500 })
    }

    const data = await response.json()
    const raw = data.content.map((i: { type: string; text?: string }) => i.text || '').join('')
    const clean = raw.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: '解析エラー' }, { status: 500 })
  }
}
