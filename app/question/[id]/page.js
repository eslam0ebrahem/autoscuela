'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import DOMPurify from 'dompurify'
import {
  LeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BulbOutlined,
  ReloadOutlined,
  RocketOutlined,
  StarOutlined,
  StarFilled,
} from '@ant-design/icons'

function sanitizeHtml(html) {
  if (typeof window === 'undefined') return ''
  return DOMPurify.sanitize(html)
}

export default function SingleQuestionReviewPage() {
  const { user, t } = useAuth()
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const questionId = params?.id

  const [question, setQuestion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bookmarked, setBookmarked] = useState(false)
  const lang = user?.preferences?.language || 'es'

  const fetchQuestion = useCallback(async () => {
    if (!questionId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/questions/${questionId}`)
      if (!res.ok) throw new Error(t('Question not found', 'Pregunta no encontrada'))
      const data = await res.json()
      setQuestion(data.question)
      
      // Check bookmark status
      const bookRes = await fetch('/api/users/bookmarks').then(r => r.json())
      if (bookRes.bookmarks?.includes(questionId)) {
        setBookmarked(true)
      }
    } catch (err) {
      console.error('[question-review] Fetch error:', err)
      toast?.error?.(t('Error', 'Error'), err.message)
    } finally {
      setLoading(false)
    }
  }, [questionId, t, toast])

  useEffect(() => {
    fetchQuestion()
  }, [fetchQuestion])

  const toggleBookmark = async () => {
    try {
      const res = await fetch('/api/users/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      })
      const data = await res.json()
      if (data.success) {
        setBookmarked(data.isBookmarked)
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-ink-light dark:text-slate-400 text-sm">
            {t('Cargando pregunta...', 'Loading question...')}
          </p>
        </div>
      </AppShell>
    )
  }

  if (!question) {
    return (
      <AppShell>
        <div className="container-wrapper max-w-2xl mx-auto text-center py-12">
          <h2 className="text-2xl font-black mb-4">{t('Pregunta no encontrada', 'Question not found')}</h2>
          <button onClick={() => router.back()} className="btn btn-primary">
            {t('Volver', 'Go Back')}
          </button>
        </div>
      </AppShell>
    )
  }

  const questionText = question.question?.[lang] || question.question?.es || ''
  const options = question.options || []
  const correctIdx = question.correct_option_idx
  const explanation = question.metadata?.help_html || ''

  return (
    <AppShell>
      <div className="container-wrapper max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-lg"
          >
            <LeftOutlined />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleBookmark}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border-2 transition-all ${
                bookmarked ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-white border-slate-100 text-slate-400'
              }`}
            >
              {bookmarked ? <StarFilled /> : <StarOutlined />}
            </button>
          </div>
        </div>

        {/* Question Card */}
        <div className="card space-y-6">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full uppercase tracking-wider">
              {t(question.topic_tag?.es, question.topic_tag?.en)}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
              question.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
              'bg-orange-100 text-orange-700'
            }`}>
              {t(question.difficulty, question.difficulty)}
            </span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-ink dark:text-white leading-tight">
            {questionText}
          </h2>

          {question.metadata?.image_url && (
            <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 max-w-md mx-auto">
              <img src={question.metadata.image_url} alt="Question" className="w-full h-auto" />
            </div>
          )}

          {/* Options */}
          <div className="grid grid-cols-1 gap-3">
            {options.map((opt, i) => {
              const isCorrect = opt.idx === correctIdx
              return (
                <div
                  key={i}
                  className={`w-full flex items-center gap-4 p-5 rounded-3xl border-2 text-left transition-all duration-200 ${
                    isCorrect 
                      ? 'border-success bg-success/10 text-success' 
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 opacity-60'
                  }`}
                >
                  <span className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black ${
                    isCorrect ? 'bg-success text-white' : 'bg-slate-100 dark:bg-slate-700 text-ink-light'
                  }`}>
                    {['A', 'B', 'C', 'D'][i]}
                  </span>
                  <span className="flex-1 font-bold text-lg">
                    {lang === 'en' ? (opt.text_en || opt.text_es) : opt.text_es}
                  </span>
                  {isCorrect && <CheckCircleOutlined className="text-2xl" />}
                </div>
              )
            })}
          </div>
        </div>

        {/* Explanation */}
        {explanation && (
          <div className="card bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/50">
            <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-200 mb-4 flex items-center gap-2">
              <BulbOutlined />
              {t('Explicación', 'Explanation')}
            </h3>
            <div 
              className="text-sm text-ink dark:text-white leading-relaxed help-html"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(explanation) }}
            />
          </div>
        )}

        {/* Action footer */}
        <div className="flex justify-center pt-6">
          <button
            onClick={() => router.push('/exam?mode=custom')}
            className="px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
          >
            <RocketOutlined />
            {t('Seguir Practicando', 'Keep Practicing')}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
