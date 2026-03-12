import './globals.css'
import { Providers } from '@/components/Providers'

export const metadata = {
  title: 'Autoscuela v4 - DGT Exam Prep',
  description: 'The smartest way to prepare for your Spanish DGT Type B driving exam. AI-powered, adaptive learning, bilingual, gamified.',
  keywords: 'DGT, driving test, Spain, examen conducir, autoescuela',
  openGraph: {
    title: 'Autoscuela v4 - DGT Exam Prep',
    description: 'AI-powered adaptive DGT exam preparation for Spain',
    type: 'website',
  },
  manifest: '/manifest.json',
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563EB" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0F172A" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Autoscuela" />
        {/* Prevent flash of unstyled content for dark mode */}
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const theme = localStorage.getItem('autoscuela-theme') || 'system';
              const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
              if (isDark) document.documentElement.classList.add('dark');
            } catch(e) {}
          `
        }} />
      </head>
      <body className="font-sans antialiased bg-canvas text-ink">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
