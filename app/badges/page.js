'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function BadgesContent() {
  const { t } = useAuth()
  const [badges, setBadges] = useState([])
  const [earned, setEarned] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/gamification/badges')
      .then((r) => r.json())
      .then((d) => { setBadges(d.badges || []); setEarned(d.earned || 0); setLoading(false) })
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink">🎖️ {t('Sala de Trofeos', 'Trophy Room')}</h1>
        <p className="text-ink-light mt-1">
          {earned > 0
            ? t(`¡Has desbloqueado ${earned} de ${badges.length} insignias!`, `You've unlocked ${earned} of ${badges.length} badges!`)
            : t('Completa desafíos para ganar insignias', 'Complete challenges to earn badges')}
        </p>
      </div>

      {/* Progress */}
      {badges.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-ink">{t('Progreso', 'Progress')}</span>
            <span className="text-sm text-ink-light">{earned} / {badges.length}</span>
          </div>
          <div className="progress-bar h-3">
            <div className="progress-fill bg-gradient-to-r from-primary to-secondary" style={{ width: `${badges.length > 0 ? (earned / badges.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-36 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`card text-center transition-all ${
                badge.unlocked
                  ? 'shadow-card-hover border-2'
                  : 'opacity-50 grayscale'
              }`}
              style={{ borderColor: badge.unlocked ? badge.color : 'transparent' }}
            >
              <div className={`text-5xl mb-3 ${badge.unlocked ? 'animate-bounce-in' : ''}`}>
                {badge.unlocked ? badge.icon : '🔒'}
              </div>
              <h3 className="font-bold text-ink text-sm mb-1">{badge.name}</h3>
              <p className="text-xs text-ink-light leading-tight">{badge.description}</p>
              {badge.unlocked && (
                <span
                  className="badge-pill mt-3 text-white text-xs"
                  style={{ backgroundColor: badge.color }}
                >
                  ✓ {t('Desbloqueado', 'Unlocked')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card bg-gradient-to-r from-slate-50 to-blue-50 border-blue-100">
        <h3 className="font-bold text-ink mb-3">💡 {t('Cómo conseguir insignias', 'How to earn badges')}</h3>
        <ul className="space-y-2 text-sm text-ink">
          <li>🚗 {t('Completa tu primer examen de práctica', 'Complete your first mock exam')}</li>
          <li>⭐ {t('Saca 30/30 en un examen oficial', 'Score 30/30 on an official DGT exam')}</li>
          <li>🌍 {t('Realiza exámenes en ambos idiomas', 'Take exams in both languages')}</li>
          <li>🏃 {t('Responde 100 preguntas en un día', 'Answer 100 questions in a single day')}</li>
          <li>🔥 {t('Mantén una racha de 7 días', 'Maintain a 7-day study streak')}</li>
          <li>🎓 {t('Alcanza el 90% en la puntuación IA', 'Reach 90% AI readiness score')}</li>
        </ul>
      </div>
    </div>
  )
}

export default function BadgesPage() {
  return (
    <AppShell>
      <BadgesContent />
    </AppShell>
  )
}
