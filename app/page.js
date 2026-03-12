import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1C] bg-gradient-to-br from-slate-900 via-[#0a1930] to-[#110c24] text-white overflow-hidden selection:bg-blue-500/30">
      
      {/* Noise texture overlay for a premium grainy look */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header / Nav */}
      <header className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <nav className="flex items-center justify-between" aria-label="Navegación principal">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg rounded-tl-none px-1 -ml-1"
          >
            <span className="text-2xl" aria-hidden="true">🚗</span>
            <span className="tracking-tight">Autoscuela</span>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/auth/login"
              className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 hidden sm:block"
            >
              Iniciar sesión / Login
            </Link>
            <Link
              href="/auth/register"
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-bold bg-white text-blue-950 hover:bg-blue-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0A0F1C]"
            >
              Empezar gratis
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-32 text-center">
          
          {/* Ambient Glowing Orbs */}
          <div className="absolute top-10 left-1/4 w-72 h-72 bg-blue-500 rounded-full blur-[100px] opacity-20 animate-pulse pointer-events-none" aria-hidden="true" />
          <div className="absolute top-20 right-1/4 w-64 h-64 bg-purple-500 rounded-full blur-[100px] opacity-20 animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} aria-hidden="true" />

          <div className="relative">
            {/* Bilingual Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs sm:text-sm font-medium mb-8 sm:mb-10 backdrop-blur-sm animate-fade-in shadow-xl">
              <span aria-hidden="true">🇪🇸</span>
              <span className="text-white/90">DGT Tipo B · Bilingüe · IA Powered</span>
              <span aria-hidden="true">🇬🇧</span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold mb-6 sm:mb-8 tracking-tight leading-[1.1] animate-slide-up">
              Aprueba el DGT
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 drop-shadow-sm">
                a la primera
              </span>
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-10 sm:mb-12 leading-relaxed animate-slide-up font-medium" style={{ animationDelay: '0.1s' }}>
              La plataforma de preparación más inteligente para el examen teórico DGT Tipo B. 
              Con <strong className="text-white font-semibold">IA Groq</strong>, modo bilingüe y gamificación para que estudiar sea divertido.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Link
                href="/auth/register"
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-lg transition-all hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] active:scale-95 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#0A0F1C]"
              >
                <span aria-hidden="true">🚀</span> Empieza gratis
              </Link>
              <Link
                href="/auth/login"
                className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl text-lg border border-white/10 hover:border-white/20 transition-all active:scale-95 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              >
                Ya tengo cuenta <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Todo lo que necesitas para aprobar</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Diseñado científicamente para optimizar tu tiempo de estudio y retención de memoria.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: '🤖',
                title: 'IA con Groq',
                desc: 'Análisis personalizado de tus puntos débiles. Sabe exactamente dónde necesitas mejorar.',
                color: 'from-blue-500/10 to-transparent hover:from-blue-500/20 border-blue-500/20',
              },
              {
                icon: '🌍',
                title: 'Bilingüe ES/EN',
                desc: 'Cambia entre español e inglés en cualquier momento, incluso durante el examen.',
                color: 'from-purple-500/10 to-transparent hover:from-purple-500/20 border-purple-500/20',
              },
              {
                icon: '🔥',
                title: 'Gamificado',
                desc: 'Rachas diarias, insignias, XP y ranking semanal. Estudiar nunca fue tan adictivo.',
                color: 'from-orange-500/10 to-transparent hover:from-orange-500/20 border-orange-500/20',
              },
              {
                icon: '📝',
                title: 'Exámenes Reales',
                desc: '30 preguntas, 30 minutos, máx. 3 fallos — exactamente como el examen DGT real.',
                color: 'from-emerald-500/10 to-transparent hover:from-emerald-500/20 border-emerald-500/20',
              },
              {
                icon: '🃏',
                title: 'Tarjetas de Memoria',
                desc: 'Sistema de repetición espaciada para memorizar señales y normas para siempre.',
                color: 'from-pink-500/10 to-transparent hover:from-pink-500/20 border-pink-500/20',
              },
              {
                icon: '📊',
                title: 'Estadísticas Detalladas',
                desc: 'Puntuación de preparación en tiempo real. Sabrás exactamente cuándo estás listo.',
                color: 'from-amber-500/10 to-transparent hover:from-amber-500/20 border-amber-500/20',
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`p-6 sm:p-8 rounded-3xl bg-gradient-to-br bg-white/5 backdrop-blur-sm border ${f.color} transition-all duration-300 hover:-translate-y-1`}
              >
                <div className="text-4xl mb-4 bg-white/5 w-14 h-14 flex items-center justify-center rounded-2xl border border-white/10" aria-hidden="true">
                  {f.icon}
                </div>
                <h3 className="font-bold text-xl mb-3 text-white">{f.title}</h3>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats Bar */}
        <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 p-8 sm:p-12 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl relative overflow-hidden">
            {/* Shine effect inside card */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-white/5 to-transparent opacity-50 pointer-events-none" />
            
            {[
              { num: '1,500+', label: 'Preguntas DGT Oficiales' },
              { num: '85%', label: 'Tasa de Aprobado' },
              { num: '2 Idiomas', label: 'Español & English' },
            ].map((s, i) => (
              <div key={i} className="text-center relative z-10">
                <div className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-blue-300 to-blue-600 mb-2">
                  {s.num}
                </div>
                <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8 sm:py-12 text-center">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-xl font-bold opacity-50 grayscale">
            <span aria-hidden="true">🚗</span>
            <span>Autoscuela</span>
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Autoscuela · Preparación DGT Tipo B · Hecho con <span aria-hidden="true">❤️</span> en España
          </p>
        </div>
      </footer>
    </div>
  )
}