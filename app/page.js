import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">🚗</span>
          <span>Autoscuela</span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/auth/login"
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all"
          >
            Iniciar sesión / Login
          </Link>
          <Link
            href="/auth/register"
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-white text-blue-900 hover:bg-blue-50 transition-all shadow-lg"
          >
            Empezar gratis / Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 text-center">
        {/* Glowing orbs */}
        <div className="absolute top-10 left-1/4 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20" />
        <div className="absolute top-20 right-1/4 w-48 h-48 bg-purple-500 rounded-full blur-3xl opacity-20" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-8 animate-fade-in">
            <span>🇪🇸</span>
            <span>DGT Tipo B · Bilingüe · IA Powered</span>
            <span>🇬🇧</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight animate-slide-up">
            Aprueba el DGT
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              a la primera
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up">
            La plataforma de preparación más inteligente para el examen teórico DGT Tipo B.
            Con IA Groq, modo bilingüe y gamificación para que estudiar sea divertido.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
            <Link
              href="/auth/register"
              className="px-8 py-4 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-2xl text-lg shadow-glow-blue transition-all active:scale-95"
            >
              🚀 Empieza gratis
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-lg border border-white/20 transition-all active:scale-95"
            >
              Ya tengo cuenta →
            </Link>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '🤖',
              title: 'IA con Groq',
              desc: 'Análisis personalizado de tus puntos débiles. Sabe exactamente dónde necesitas mejorar.',
              color: 'from-blue-500/20 to-blue-500/5',
            },
            {
              icon: '🌍',
              title: 'Bilingüe ES/EN',
              desc: 'Cambia entre español e inglés en cualquier momento, incluso durante el examen.',
              color: 'from-purple-500/20 to-purple-500/5',
            },
            {
              icon: '🔥',
              title: 'Gamificado',
              desc: 'Rachas diarias, insignias, XP y ranking semanal. Estudiar nunca fue tan adictivo.',
              color: 'from-orange-500/20 to-orange-500/5',
            },
            {
              icon: '📝',
              title: 'Exámenes Reales',
              desc: '30 preguntas, 30 minutos, máx. 3 fallos — exactamente como el examen DGT real.',
              color: 'from-emerald-500/20 to-emerald-500/5',
            },
            {
              icon: '🃏',
              title: 'Tarjetas de Memoria',
              desc: 'Sistema de repetición espaciada para memorizar señales y normas para siempre.',
              color: 'from-pink-500/20 to-pink-500/5',
            },
            {
              icon: '📊',
              title: 'Estadísticas Detalladas',
              desc: 'Puntuación de preparación en tiempo real. Sabrás exactamente cuándo estás listo.',
              color: 'from-amber-500/20 to-amber-500/5',
            },
          ].map((f, i) => (
            <div
              key={i}
              className={`p-6 rounded-2xl bg-gradient-to-br ${f.color} border border-white/10 hover:border-white/20 transition-all hover:scale-105 group`}
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-3 gap-6 p-8 rounded-2xl bg-white/5 border border-white/10">
          {[
            { num: '1,500+', label: 'Preguntas DGT' },
            { num: '85%', label: 'Tasa de aprobado' },
            { num: '2 idiomas', label: 'Español & English' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-400 mb-1">{s.num}</div>
              <div className="text-sm text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-white/40 text-sm">
        <p>© {new Date().getFullYear()} Autoscuela · DGT Tipo B · hecho con ❤️ en España</p>
      </footer>
    </div>
  )
}
