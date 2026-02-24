import './globals.css'

export const metadata = {
  title: 'Autoscuela - DGT Exam Prep',
  description: 'The smartest way to prepare for your Spanish DGT Type B driving exam. AI-powered, bilingual, gamified.',
  keywords: 'DGT, driving test, Spain, examen conducir, autoescuela',
  openGraph: {
    title: 'Autoscuela - DGT Exam Prep',
    description: 'AI-powered DGT exam preparation for Spain',
    type: 'website',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#2563EB" />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
