'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import {
  AimOutlined,
  ToolOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  AuditOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'

function ExamSetup() {
  const { user, t } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const aiTopics = searchParams.get('topics')?.split(',').filter(Boolean) || []
  const isAI = searchParams.get('ai') === '1'

  const lang = user?.preferences?.language || 'es'
  const urlMode = searchParams.get('mode')
  const [mode, setMode] = useState(urlMode || (isAI ? 'custom' : 'official'))
  const [assistanceMode, setAssistanceMode] = useState('exam')
  const [selectedTopics, setSelectedTopics] = useState(aiTopics)
  const [availableTopics, setAvailableTopics] = useState([])
  
  // Loading & Error States
  const [loading, setLoading] = useState(false)
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let isMounted = true;

    fetch('/api/flashcards/decks')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch topics')
        return r.json()
      })
      .then((d) => {
        if (isMounted) {
          setAvailableTopics(d.decks || [])
          setTopicsLoading(false)
        }
      })
      .catch((err) => {
        console.error('Error fetching topics:', err)
        if (isMounted) {
          setAvailableTopics([])
          setTopicsLoading(false)
        }
      })

    return () => { isMounted = false }
  }, [])

  const toggleTopic = (tag) => {
    setSelectedTopics((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const startExam = async () => {
    setLoading(true)
    setErrorMsg('')

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
      
      const data = await res.json().catch(() => ({}))
      
      if (res.ok && data.sessionId) {
        router.push(`/exam/${data.sessionId}`)
      } else {
        setErrorMsg(data.error || t('Error al iniciar el examen', 'Failed to start exam'))
      }
    } catch (e) {
      console.error('Start exam error:', e)
      setErrorMsg(t('Hubo un problema de conexión', 'There was a connection error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-12">
      <div>
        <h1 className="text-3xl font-black text-ink dark:text-white">{t('Configurar Examen', 'Configure Exam')}</h1>
        <p className="text-ink-light font-medium mt-1">{t('Personaliza tu sesión de práctica', 'Customize your practice session')}</p>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-danger border-2 border-red-100 dark:border-red-900/50 rounded-2xl font-bold animate-fade-in">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Mode selection */}
      <div className="card glass space-y-4">
        <h2 className="font-black text-ink dark:text-white text-lg">{t('1. Modo de examen', '1. Exam Mode')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              val: 'official',
              icon: <AimOutlined />,
              title: t('Simulación Oficial DGT', 'Official DGT Simulation'),
              desc: t('30 preguntas · 30 min · máx. 3 fallos', '30 questions · 30 min · max 3 errors'),
              color: 'border-primary bg-primary/5',
            },
            {
              val: 'custom',
              icon: <ToolOutlined />,
              title: t('Práctica Personalizada', 'Custom Practice'),
              desc: t('Elige temas y número de preguntas', 'Choose topics and number of questions'),
              color: 'border-secondary bg-secondary/5',
            },
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => setMode(opt.val)}
              type="button"
              className={`p-5 rounded-3xl border-2 text-left transition-all active:scale-[0.98] focus:outline-none ${
                mode === opt.val ? opt.color + ' border-primary' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/30'
              }`}
            >
              <div className="text-2xl mb-3 text-primary">{opt.icon}</div>
              <div className="font-black text-ink dark:text-white">{opt.title}</div>
              <div className="text-xs text-ink-light font-medium mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Topic filter (custom mode) */}
      {mode === 'custom' && (
        <div className="card glass space-y-4 animate-scale-in">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-ink dark:text-white text-lg">{t('2. Filtrar por Tema', '2. Filter by Topic')}</h2>
            {selectedTopics.length > 0 && (
              <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                {selectedTopics.length} {t('seleccionados', 'selected')}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-light font-medium">{t('Deja vacío para preguntas de todos los temas', 'Leave empty for questions from all topics')}</p>

          {topicsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : availableTopics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableTopics.map(({ tag, tagEn, count }) => {
                const displayTag = lang === 'en' ? (tagEn || tag) : (tag || tagEn)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTopic(tag)}
                    type="button"
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border-2 focus:outline-none ${
                      selectedTopics.includes(tag)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-100 dark:border-slate-800 text-ink-light hover:border-primary/30'
                    }`}
                  >
                    {displayTag}
                    <span className="ml-1 opacity-60">({count})</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-ink-light italic">{t('No hay temas disponibles', 'No topics available')}</p>
          )}
        </div>
      )}

      {/* Assistance mode */}
      <div className="card glass space-y-4">
        <h2 className="font-black text-ink dark:text-white text-lg">
          {t('3. Modo de Asistencia', '3. Assistance Mode')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              val: 'exam',
              icon: <AuditOutlined />,
              title: t('Modo Examen', 'Exam Mode'),
              desc: t('Resultados al final. Como el DGT real.', 'Results at the end. Just like the real DGT.'),
            },
            {
              val: 'instant',
              icon: <ThunderboltOutlined />,
              title: t('Retroalimentación Inmediata', 'Instant Feedback'),
              desc: t('Ver respuesta correcta tras cada pregunta', 'See correct answer after each question'),
            },
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => setAssistanceMode(opt.val)}
              type="button"
              className={`p-5 rounded-3xl border-2 text-left transition-all active:scale-[0.98] focus:outline-none ${
                assistanceMode === opt.val
                  ? 'border-success bg-success/5 border-success'
                  : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/30'
              }`}
            >
              <div className="text-2xl mb-3 text-primary">{opt.icon}</div>
              <div className="font-black text-ink dark:text-white">{opt.title}</div>
              <div className="text-xs text-ink-light font-medium mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Summary + Start */}
      <div className="card glass border-0 bg-gradient-to-br from-primary to-indigo-700 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="font-black text-xl">
              {mode === 'official'
                ? t('Simulación Oficial DGT', 'Official DGT Simulation')
                : t('Práctica Personalizada', 'Custom Practice')}
            </h3>
            <p className="text-sm font-medium opacity-80 mt-1">
              {mode === 'official' 
                ? '30Q · 30min' 
                : `${selectedTopics.length ? selectedTopics.join(', ') : t('Todos los temas', 'All topics')}`}
              {' · '}
              {assistanceMode === 'exam' ? t('Modo examen', 'Exam mode') : t('Retroalimentación inmediata', 'Instant feedback')}
            </p>
          </div>
          <button
            onClick={startExam}
            disabled={loading}
            className="px-10 py-4 bg-white text-primary font-black rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-lg shadow-black/10 w-full sm:w-auto flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">{t('Cargando...', 'Loading...')}</span>
            ) : (
              <>{t('¡Empezar!', 'Start!')} <RocketOutlined /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Fallback component for the Suspense boundary
function ExamSetupFallback() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 p-8 flex justify-center items-center h-64">
      <div className="animate-pulse text-ink-light font-black uppercase tracking-widest text-xs">Cargando configuración...</div>
    </div>
  )
}

export default function ExamPage() {
  return (
    <AppShell requirePremium>
      <Suspense fallback={<ExamSetupFallback />}>
        <ExamSetup />
      </Suspense>
    </AppShell>
  )
}
