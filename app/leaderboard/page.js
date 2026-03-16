'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function LeaderboardContent() {
  const { t } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/gamification/leaderboard')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
  }, [])

  const rankIcon = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink">
          🏆 {t('Ranking Semanal', 'Weekly Leaderboard')}
        </h1>
        <p className="text-ink-light mt-1">
          {t(
            'Top 50 estudiantes de esta semana. ¡Gana XP para subir!',
            'Top 50 students this week. Earn XP to climb!'
          )}
        </p>
      </div>

      {/* XP info */}
      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-blue-100">
        <h3 className="font-bold text-ink mb-3">⚡ {t('Cómo ganar XP', 'How to earn XP')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: '+10', label: t('Aprobar examen', 'Pass exam'), icon: '✅' },
            { val: '+5', label: t('Fallar examen', 'Fail exam'), icon: '💪' },
            { val: '+1', label: t('Tarjeta correcta', 'Correct card'), icon: '🃏' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="text-xl mb-1">{item.icon}</div>
              <div className="text-lg font-bold text-primary">{item.val}</div>
              <div className="text-xs text-ink-light">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Your position */}
      {data?.userPosition && (
        <div className="card border-primary">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-light">{t('Tu posición', 'Your position')}</p>
              <p className="text-2xl font-bold text-primary">#{data.userPosition.rank}</p>
              <p className="text-sm text-ink">{data.userPosition.nickname}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-secondary">{data.userPosition.weeklyXP}</p>
              <p className="text-sm text-ink-light">XP {t('esta semana', 'this week')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top 50 */}
      <div className="card">
        <h2 className="font-bold text-lg text-ink mb-4">
          {t('Top 50 · Esta semana', 'Top 50 · This week')}
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data?.leaderboard?.length > 0 ? (
          <div className="space-y-2">
            {data.leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                  entry.isCurrentUser
                    ? 'bg-blue-50 border border-primary'
                    : entry.rank <= 3
                      ? 'bg-amber-50'
                      : 'bg-slate-50'
                }`}
              >
                <div className="w-10 text-center">
                  <span
                    className={`font-bold ${entry.rank <= 3 ? 'text-2xl' : 'text-sm text-ink-light'}`}
                  >
                    {rankIcon(entry.rank)}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold">
                  {entry.nickname[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-ink">
                    {entry.nickname}
                    {entry.isCurrentUser && (
                      <span className="ml-2 text-xs text-primary font-normal">
                        {t('(tú)', '(you)')}
                      </span>
                    )}
                  </span>
                  {entry.streak > 0 && (
                    <span className="ml-2 text-xs text-orange-500">🔥 {entry.streak}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-bold text-secondary">{entry.weeklyXP}</span>
                  <span className="text-xs text-ink-light ml-1">XP</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-ink-light py-8">
            {t('¡Sé el primero en ganar XP esta semana!', 'Be the first to earn XP this week!')}
          </p>
        )}
      </div>

      <p className="text-xs text-center text-ink-light">
        🔒{' '}
        {t(
          'El ranking solo muestra tu apodo anónimo, nunca tu nombre real o email.',
          'The leaderboard only shows your anonymous nickname, never your real name or email.'
        )}
        <br />
        {t(
          'Se resetea cada domingo a medianoche (hora Madrid)',
          'Resets every Sunday at midnight (Madrid time)'
        )}
      </p>
    </div>
  )
}

export default function LeaderboardPage() {
  return (
    <AppShell>
      <LeaderboardContent />
    </AppShell>
  )
}
