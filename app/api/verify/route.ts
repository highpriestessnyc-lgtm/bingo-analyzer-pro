import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { licenseKey } = await req.json()
    if (!licenseKey) return NextResponse.json({ valid: false, error: 'キーが空です' })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY

    console.log('Checking key:', licenseKey)
    console.log('URL:', supabaseUrl)

    const url = `${supabaseUrl}/rest/v1/license_keys?select=id,email,expires_at,usage_count&key=eq.${licenseKey}&is_active=eq.true`
    console.log('Fetch URL:', url)

    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      }
    })

    console.log('Supabase status:', res.status)
    const data = await res.json()
    console.log('Supabase data:', JSON.stringify(data))

    if (!data || data.length === 0) {
      return NextResponse.json({ valid: false, error: '無効なライセンスキーです' })
    }

    const license = data[0]

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'ライセンスキーの有効期限が切れています' })
    }

    await fetch(`${supabaseUrl}/rest/v1/license_keys?key=eq.${licenseKey}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ usage_count: (license.usage_count || 0) + 1 })
    })

    return NextResponse.json({ valid: true, email: license.email })
  } catch (err) {
    console.error('Verify error:', err)
    return NextResponse.json({ valid: false, error: 'サーバーエラー' })
  }
}
