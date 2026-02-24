'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function ExamSetup() {
  const { user, t } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const aiTopics = searchParams.get('topics')?.split(',').filter(Boolean) || []
  const isAI = searchParams.get('ai') === '1'

  const [mode, setMode] = useState(isAI ? 'custom' : 'official')
  const [assistanceMode, setAssistanceMode] = useState('exam')
  const [selectedTopics, setSelectedTopics] = useState(aiTopics)
  const [availableTopics, setAvailableTopics] = useState([])
  const [loading, setLoading] = useState(false)
  const [topicsLoading, setTopicsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flashcards/decks')
      .then((r) => r.json())
      .then((d) => {
        setAvailableTopics(d.decks || [])
        setTopicsLoading(false)
      })
  }, [])

  const toggleTopic = (tag) => {
    setSelectedTopics((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const startExam = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          topic_filter: mode === 'custom' ? selectedTopics : null,
          assistance_mode: assistanceMode,
        }),
      })
      const data = await res.json()
      if (data.sessionId) {
        router.push(`/exam/${data.sessionId}`)
      } else {
        alert(data.error || 'Failed to start exam')
      }
    } catch (e) {
      alert('Error starting exam')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-ink">{t('Configurar Examen', 'Configure Exam')}</h1>
        <p className="text-ink-light mt-1">{t('Personaliza tu sesión de práctica', 'Customize your practice session')}</p>
      </div>

      {/* Mode selection */}
      <div className="card space-y-4">
        <h2 className="font-bold text-ink text-lg">{t('1. Modo de examen', '1. Exam Mode')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              val: 'official',
              icon: '🎯',
              title: t('Simulación Oficial DGT', 'Official DGT Simulation'),
              desc: t('30 preguntas · 30 min · máx. 3 fallos', '30 questions · 30 min · max 3 errors'),
              color: 'border-primary bg-blue-50',
            },
            {
              val: 'custom',
              icon: '🛠️',
              title: t('Práctica Personalizada', 'Custom Practice'),
              desc: t('Elige temas y número de preguntas', 'Choose topics and number of questions'),
              color: 'border-secondary bg-purple-50',
            },
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => setMode(opt.val)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                mode === opt.val ? opt.color : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-2xl mb-2">{opt.icon}</div>
              <div className="font-bold text-ink">{opt.title}</div>
              <div className="text-sm text-ink-light">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Topic filter (custom mode) */}
      {mode === 'custom' && (
        <div className="card space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink text-lg">{t('2. Filtrar por Tema', '2. Filter by Topic')}</h2>
            {selectedTopics.length > 0 && (
              <span className="badge-pill bg-primary text-white text-xs">
                {selectedTopics.length} {t('seleccionados', 'selected')}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-light">{t('Deja vacío para preguntas de todos los temas', 'Leave empty for questions from all topics')}</p>

          {topicsLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-10 bg-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableTopics.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => toggleTopic(tag)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border-2 ${
                    selectedTopics.includes(tag)
                      ? 'border-secondary bg-purple-50 text-secondary'
                      : 'border-slate-200 text-ink hover:border-slate-300'
                  }`}
                >
                  {tag}
                  <span className="ml-1 text-xs text-ink-light">({count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assistance mode */}
      <div className="card space-y-4">
        <h2 className="font-bold text-ink text-lg">
          {t('3. Modo de Asistencia', '3. Assistance Mode')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              val: 'exam',
              icon: '🔇',
              title: t('Modo Examen', 'Exam Mode'),
              desc: t('Resultados al final. Como el DGT real.', 'Results at the end. Just like the real DGT.'),
            },
            {
              val: 'instant',
              icon: '⚡',
              title: t('Retroalimentación Inmediata', 'Instant Feedback'),
              desc: t('Ver respuesta correcta tras cada pregunta', 'See correct answer after each question'),
            },
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => setAssistanceMode(opt.val)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                assistanceMode === opt.val
                  ? 'border-success bg-emerald-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="text-2xl mb-2">{opt.icon}</div>
              <div className="font-bold text-ink">{opt.title}</div>
              <div className="text-sm text-ink-light">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Summary + Start */}
      <div className="card bg-gradient-to-r from-slate-50 to-blue-50 border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-ink">
              {mode === 'official'
                ? t('Simulación Oficial DGT', 'Official DGT Simulation')
                : t('Práctica Personalizada', 'Custom Practice')}
            </h3>
            <p className="text-sm text-ink-light mt-1">
              {mode === 'official' ? '30Q · 30min' : `${selectedTopics.length ? selectedTopics.join(', ') : t('Todos los temas', 'All topics')}`}
              {' · '}
              {assistanceMode === 'exam' ? t('Modo examen', 'Exam mode') : t('Retroalimentación inmediata', 'Instant feedback')}
            </p>
          </div>
          <button
            onClick={startExam}
            disabled={loading}
            className="btn-primary text-lg px-8 py-4"
          >
            {loading ? '...' : `${t('¡Empezar!', 'Start!')} 🚀`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ExamPage() {
  return (
    <AppShell requirePremium>
      <ExamSetup />
    </AppShell>
  )
}
