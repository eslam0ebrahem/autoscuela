import './globals.css'
import { Providers } from '@/components/Providers'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
export const metadata = {
  title: {
    default: 'Vialia - DGT Exam Prep | AI-Powered Driving Test Preparation',
    template: '%s | Vialia DGT Exam',
  },
  description:
    'The smartest way to prepare for your Spanish DGT Type B driving exam. AI-powered adaptive learning, bilingual support (ES/EN), gamified experience. Pass your driving test with confidence.',
  keywords: [
    'DGT',
    'driving test Spain',
    'examen conducir',
    'autoescuela',
    'DGT Type B',
    'Spanish driving license',
    'carnet de conducir',
    'permiso B',
    'AI exam prep',
    'adaptive learning',
    'bilingual driving test',
  ],
  authors: [{ name: 'Vialia Team' }],
  creator: 'Vialia',
  publisher: 'Vialia',
  applicationName: 'Vialia DGT Exam Prep',

  // Open Graph
  openGraph: {
    title: 'Vialia - AI-Powered DGT Exam Preparation',
    description:
      'Pass your Spanish driving test faster with AI-powered adaptive learning. Bilingual, gamified, and proven effective.',
    url: 'https://vialia.app',
    siteName: 'Vialia',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: 'https://vialia.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vialia - DGT Exam Preparation Platform',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Vialia - AI-Powered DGT Exam Prep',
    description: 'Pass your Spanish driving test with AI-powered adaptive learning',
    images: ['https://vialia.app/twitter-image.png'],
    creator: '@vialia_app',
  },

  // PWA
  manifest: '/manifest.json',

  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },

  // Verification
  verification: {
    google: 'your-google-site-verification-code',
    // yandex: 'your-yandex-verification',
    // other: 'your-other-verification',
  },

  // App links (for mobile deep linking)
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vialia DGT',
  },

  // Alternative languages
  alternates: {
    canonical: 'https://vialia.app',
    languages: {
      'es-ES': 'https://vialia.app/es',
      'en-US': 'https://vialia.app/en',
    },
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Other
  category: 'education',
}

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6366f1' },
    { media: '(prefers-color-scheme: dark)', color: '#1e293b' },
  ],
}

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------
export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Prevent flash of unstyled content for dark mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch for CDNs */}
        <link rel="dns-prefetch" href="https://cdn.example.com" />
      </head>
      <body className="bg-surface dark:bg-slate-950 text-ink dark:text-white antialiased">
        {/* 5.1: Skip-to-content link for keyboard navigation */}
        <a
          href="#main-content"
          className="absolute -top-14 left-4 z-50 px-4 py-2 bg-primary text-white rounded-lg font-bold focus:top-4 transition-all duration-200 sr-only focus:not-sr-only"
        >
          Ir al contenido principal (Skip to main content)
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
