import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BINGO LADDER ANALYZER PRO',
  description: 'XAUUSD チャート解析 by BINGO LADDER PRO',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0, background: '#0a0a0f', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
