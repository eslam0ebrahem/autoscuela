import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B0F14] bg-gradient-to-br from-[#0B0F14] via-[#111827]
      to-[#0F172A] text-white overflow-hidden selection:bg-indigo-500/30">

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* ── Header ── */}
      <header className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <nav className="flex items-center justify-between" aria-label="Navegación principal">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold focus:outline-none
              focus:ring-2 focus:ring-indigo-500 rounded-lg px-1 -ml-1"
          >
            <span className="text-2xl text-indigo-400" aria-hidden="true">✨</span>
            <span className="tracking-tight font-extrabold text-2xl">Vialia</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="hidden sm:block px-4 py-2 rounded-xl text-sm font-semibold
                text-white/70 hover:text-white hover:bg-white/5 transition-colors
                focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Acceso / Login
            </Link>
            <Link
              href="/auth/register"
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-bold
                bg-indigo-600 text-white hover:bg-indigo-500 transition-all
                shadow-[0_0_20px_rgba(99,102,241,0.2)]
                hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]
                hover:scale-[1.02] active:scale-[0.98]
                focus:outline-none focus:ring-2 focus:ring-white
                focus:ring-offset-2 focus:ring-offset-[#0B0F14]"
            >
              Comenzar ahora
            </Link>
          </div>
        </nav>
      </header>

      <main>

        {/* ── Hero ── */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6
          pt-12 sm:pt-20 pb-20 sm:pb-32 text-center">

          {/* Ambient orbs */}
          <div className="absolute top-10 left-1/4 w-72 h-72 bg-indigo-600 rounded-full
            blur-[120px] opacity-20 animate-pulse pointer-events-none" aria-hidden="true" />
          <div className="absolute top-20 right-1/4 w-64 h-64 bg-emerald-500 rounded-full
            blur-[120px] opacity-10 animate-pulse pointer-events-none"
            style={{ animationDelay: '1s' }} aria-hidden="true" />

          <div className="relative">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
              bg-white/5 border border-white/10 text-xs sm:text-sm font-medium
              mb-8 backdrop-blur-sm shadow-xl">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/90">DGT Tipo B · IA Adaptive Learning</span>
            </div>

            {/* H1 */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black
              mb-6 tracking-tight leading-[1.05]">
              Domina el DGT
              <br />
              <span className="text-transparent bg-clip-text
                bg-gradient-to-r from-indigo-400 via-emerald-400 to-indigo-400 bg-[length:200%_auto] animate-shimmer">
                con Inteligencia
              </span>
            </h1>

            {/* Sub */}
            <p className="text-lg sm:text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto
              mb-10 sm:mb-12 leading-relaxed font-medium">
              La evolución del aprendizaje vial. <strong className="text-white font-semibold">Vialia</strong> utiliza IA de última generación
              para que apruebes tu examen teórico en tiempo récord y con total confianza.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center">
              <Link
                href="/auth/register"
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold
                  rounded-2xl text-lg transition-all
                  hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]
                  active:scale-95 flex items-center justify-center gap-2
                  focus:outline-none focus:ring-2 focus:ring-indigo-400
                  focus:ring-offset-2 focus:ring-offset-[#0B0F14]"
              >
                🚀 Empieza gratis
              </Link>
              <Link
                href="/auth/login"
                className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold
                  rounded-2xl text-lg border border-white/10 hover:border-white/20
                  transition-all active:scale-95 flex items-center justify-center gap-2
                  focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              >
                Ver Demo <span aria-hidden="true">→</span>
              </Link>
            </div>

            {/* Social proof micro-line */}
            <p className="mt-6 text-xs text-white/20 font-medium tracking-widest uppercase">
              Bilingüe Español / English · Sin tarjeta · 100% Online
            </p>
          </div>
        </section>

        {/* ── Features Grid ── */}
        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
          <div className="text-center mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-5xl font-bold mb-6 tracking-tight">
              ¿Por qué elegir <span className="text-indigo-400">Vialia</span>?
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-base sm:text-lg">
              Tecnología diseñada para optimizar tu tiempo y garantizar tu aprobado.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: '🧠',
                title: 'IA Adaptativa',
                desc: 'Nuestro motor analiza tus respuestas en tiempo real para enfocarse en lo que realmente te cuesta.',
                color: 'from-indigo-500/10 hover:from-indigo-500/20 border-indigo-500/20',
              },
              {
                icon: '🌍',
                title: 'Modo Bilingüe Instantáneo',
                desc: 'Cambia entre español e inglés con un solo clic. Ideal para residentes internacionales.',
                color: 'from-emerald-500/10 hover:from-emerald-500/20 border-emerald-500/20',
              },
              {
                icon: '🌌',
                title: 'Gamificación Épica',
                desc: 'Gana XP, sube de nivel y compite en el ranking. Aprender ya no es una tarea, es un juego.',
                color: 'from-purple-500/10 hover:from-purple-500/20 border-purple-500/20',
              },
              {
                icon: '⏱️',
                title: 'Simulacros Reales',
                desc: 'Base de datos actualizada con las preguntas oficiales de la DGT para este año.',
                color: 'from-blue-500/10 hover:from-blue-500/20 border-blue-500/20',
              },
              {
                icon: '🎴',
                title: 'Flashcards Inteligentes',
                desc: 'Repetición espaciada para que no olvides las señales de tráfico nunca más.',
                color: 'from-pink-500/10 hover:from-pink-500/20 border-pink-500/20',
              },
              {
                icon: '📈',
                title: 'Vialia Analytics',
                desc: 'Gráficos detallados de tu evolución. Sabrás que vas a aprobar antes de ir al examen.',
                color: 'from-amber-500/10 hover:from-amber-500/20 border-amber-500/20',
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`p-8 sm:p-10 rounded-[2.5rem] bg-gradient-to-br bg-white/5
                  backdrop-blur-md border to-transparent
                  transition-all duration-500 hover:-translate-y-2 group ${f.color}`}
              >
                <div className="text-4xl mb-6 bg-white/5 w-16 h-16
                  flex items-center justify-center rounded-2xl border border-white/10
                  group-hover:scale-110 transition-transform duration-500"
                  aria-hidden="true">
                  {f.icon}
                </div>
                <h3 className="font-bold text-2xl mb-4 text-white hover:text-indigo-300 transition-colors">{f.title}</h3>
                <p className="text-slate-400 text-base leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-24 sm:pb-32">
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6
            p-10 sm:p-16 rounded-[3rem] bg-indigo-600/5 backdrop-blur-xl
            border border-white/10 shadow-2xl overflow-hidden">

            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10
               via-transparent to-emerald-500/10 opacity-50 pointer-events-none" aria-hidden="true" />

            {[
              { num: '2,000+', label: 'Preguntas Actualizadas' },
              { num: '98%',    label: 'Precisión de la IA'        },
              { num: '24/7',   label: 'Soporte e Inteligencia' },
            ].map((s, i) => (
              <div key={i} className="text-center relative z-10">
                <div className="text-5xl sm:text-6xl font-black text-transparent
                  bg-clip-text bg-gradient-to-br from-indigo-300 to-indigo-600 mb-3 tracking-tighter">
                  {s.num}
                </div>
                <div className="text-xs font-bold text-indigo-400/80 uppercase tracking-[0.2em]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-28 text-center">
          <div className="rounded-[3rem] bg-gradient-to-br from-indigo-600/20 to-emerald-600/10
            border border-white/10 p-12 sm:p-20 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-indigo-500/20 blur-[100px]" />
            
            <h2 className="text-4xl sm:text-5xl font-black mb-6 leading-tight">
              Tu aprobado empieza<br />
              <span className="text-transparent bg-clip-text
                bg-gradient-to-r from-indigo-400 to-emerald-400">
                en Vialia
              </span>
            </h2>
            <p className="text-slate-400 mb-10 text-lg max-w-lg mx-auto">
              Únete a la nueva era de la formación vial. Inteligente, rápido y efectivo.
            </p>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-3 px-12 py-5 bg-indigo-600
                hover:bg-indigo-500 text-white font-bold rounded-2xl text-xl
                transition-all hover:shadow-[0_0_50px_rgba(99,102,241,0.5)]
                hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400
                focus:ring-offset-2 focus:ring-offset-[#0B0F14]"
            >
              🚀 Comenzar Gratis
            </Link>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-12 sm:py-16 text-center">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-2xl font-black text-white/40 grayscale hover:grayscale-0 transition-all duration-500 cursor-default">
            <span className="text-indigo-500/50" aria-hidden="true">✨</span>
            <span>Vialia</span>
          </div>
          <p className="text-slate-600 text-sm font-medium tracking-wide">
            © {new Date().getFullYear()} Vialia · AI-Powered DGT Prep ·
            Hecho con <span className="text-indigo-500/50" aria-hidden="true">✦</span> en España
          </p>
        </div>
      </footer>
    </div>
  )
}
