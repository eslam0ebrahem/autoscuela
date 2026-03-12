'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import AppShell from '@/components/AppShell'
import DOMPurify from 'dompurify'

// Properly use DOMPurify to prevent XSS attacks
function sanitizeHtml(html) {
    if (typeof window === 'undefined') return ''
    return DOMPurify.sanitize(html)
}

function ReviewInterface() {
    const { user, t } = useAuth()
    const params = useParams()
    const router = useRouter()
    const sessionId = params?.sessionId

    const [session, setSession] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    
    const lang = user?.preferences?.language || 'es'
    const [expandedImage, setExpandedImage] = useState(null)
    const [showExplanationMap, setShowExplanationMap] = useState({})
    const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set())

    useEffect(() => {
        if (!sessionId) return

        // Fetch initial bookmarks
        fetch('/api/users/bookmarks')
            .then(r => r.ok ? r.json() : {})
            .then(data => {
                if (data.bookmarks) {
                    setBookmarkedQuestions(new Set(data.bookmarks))
                }
            })
            .catch(console.error)

        // Fetch exam session details
        fetch(`/api/exams/${sessionId}`)
            .then((r) => {
                if (!r.ok) throw new Error('Failed to fetch exam review')
                return r.json()
            })
            .then((data) => {
                setSession(data.session)
                setQuestions(data.questions || [])
            })
            .catch((err) => {
                console.error(err)
                setError(true)
            })
            .finally(() => {
                setLoading(false)
            })
    }, [sessionId])

    const toggleExplanation = (idx) => {
        setShowExplanationMap(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }))
    }

    const toggleBookmark = async (questionId) => {
        try {
            const res = await fetch('/api/users/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId })
            })
            const data = await res.json()
            if (data.success) {
                setBookmarkedQuestions(prev => {
                    const newSet = new Set(prev)
                    data.isBookmarked ? newSet.add(questionId) : newSet.delete(questionId)
                    return newSet
                })
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error)
        }
    }

    // ==== RENDER: LOADING ====
    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="text-4xl animate-bounce mb-4" role="img" aria-label="Loading">🔍</div>
                    <p className="text-ink-light dark:text-slate-400">{t('Cargando revisión...', 'Loading review...')}</p>
                </div>
            </div>
        )
    }

    // ==== RENDER: ERROR / NOT FOUND ====
    if (error || !session || !questions?.length) {
        return (
            <div className="text-center py-20 px-4">
                <div className="text-6xl mb-4" role="img" aria-label="Not found">😕</div>
                <h2 className="text-2xl font-bold mb-4 text-ink dark:text-white">
                    {t('Examen no encontrado', 'Exam not found')}
                </h2>
                <p className="text-ink-light dark:text-slate-400 mb-8">
                    {t('No pudimos cargar los resultados de este examen.', 'We could not load the results for this exam.')}
                </p>
                <button onClick={() => router.push('/exam')} className="btn-primary">
                    {t('Volver a exámenes', 'Back to exams')}
                </button>
            </div>
        )
    }

    // Map user answers for quick lookup
    const answerMap = {}
    session.answers?.forEach(a => {
        answerMap[a.questionId] = a
    })

    // ==== RENDER: REVIEW ====
    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
            
            {/* Header Controls */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => router.push(`/exam/${sessionId}`)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-ink-light transition-colors flex items-center gap-2 font-medium"
                >
                    <span aria-hidden="true">←</span> {t('Volver al resultado', 'Back to exam result')}
                </button>
            </div>

            {/* Score Summary */}
            <div className="mb-6 card text-center p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <h1 className="text-2xl font-bold mb-2 text-ink dark:text-white">
                    {t('Revisión del Examen', 'Exam Review')}
                </h1>
                <div className="flex justify-center gap-6 mt-4">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 w-28 border border-slate-100 dark:border-slate-800">
                        <div className="text-3xl font-bold text-success">{session.score || 0}</div>
                        <div className="text-xs text-ink-light uppercase tracking-wider font-semibold mt-1">
                            {t('Correctas', 'Correct')}
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 w-28 border border-slate-100 dark:border-slate-800">
                        <div className="text-3xl font-bold text-danger">{session.errorCount || 0}</div>
                        <div className="text-xs text-ink-light uppercase tracking-wider font-semibold mt-1">
                            {t('Errores', 'Errors')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Questions List */}
            {questions.map((q, idx) => {
                const getLocalizedText = (obj) => {
                    if (!obj) return ''
                    if (typeof obj === 'string') return obj
                    if (lang === 'en' && obj.en) return obj.en
                    return obj.es || obj.en || ''
                }

                const questionText = getLocalizedText(q.question)
                const userAnswer = answerMap[q._id]
                const selectedOptionIdx = userAnswer?.selectedOptionIdx
                const correctIdx = q.correct_option_idx
                const helpHtml = q.metadata?.help_html

                return (
                    <div key={q._id} className="card relative p-0 overflow-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex flex-col md:flex-row h-full">
                            
                            {/* Question Image */}
                            {q.metadata?.image_url && (
                                <button 
                                    className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-900 relative flex items-center justify-center min-h-[16rem] cursor-zoom-in border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 hover:opacity-95 transition-opacity"
                                    onClick={() => setExpandedImage(q.metadata.image_url)}
                                    aria-label={t('Ampliar imagen', 'Expand image')}
                                >
                                    <img
                                        src={q.metadata.image_url}
                                        alt={t('Imagen de la pregunta', 'Question image')}
                                        className="w-full h-full max-h-64 md:max-h-full object-contain absolute inset-0 p-4"
                                    />
                                </button>
                            )}

                            {/* Question Content */}
                            <div className={`p-6 md:p-8 flex flex-col justify-center w-full relative ${q.metadata?.image_url ? 'md:w-1/2' : ''}`}>
                                
                                {/* Top Right Info */}
                                <div className="absolute top-4 right-4 flex items-center gap-3">
                                    <button
                                        onClick={() => toggleBookmark(q._id)}
                                        className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                                            bookmarkedQuestions.has(q._id) 
                                            ? 'text-amber-500 hover:text-amber-600' 
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                        aria-label={bookmarkedQuestions.has(q._id) ? t('Quitar de guardados', 'Remove bookmark') : t('Guardar pregunta', 'Bookmark question')}
                                    >
                                        {bookmarkedQuestions.has(q._id) ? `⭐ ${t('Guardado', 'Saved')}` : `☆ ${t('Guardar', 'Save')}`}
                                    </button>
                                    <div className="text-sm font-bold text-ink-light bg-slate-100 dark:bg-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg">
                                        {idx + 1} / {questions.length}
                                    </div>
                                </div>

                                <h2 className="text-lg font-semibold text-ink dark:text-white mt-8 mb-6 pr-14 leading-relaxed">
                                    {questionText}
                                </h2>

                                {/* Options */}
                                <div className="space-y-3">
                                    {q.options?.map((opt) => {
                                        const text = lang === 'en' && opt.text_en ? opt.text_en : opt.text_es
                                        const letter = ['A', 'B', 'C', 'D'][opt.idx]

                                        let cls = 'flex text-left items-center w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 '

                                        if (opt.idx === correctIdx) {
                                            cls += 'border-success bg-success/10 text-success'
                                        } else if (opt.idx === selectedOptionIdx && selectedOptionIdx !== correctIdx) {
                                            cls += 'border-danger bg-danger/10 text-danger'
                                        } else {
                                            cls += 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-ink-light opacity-60'
                                        }

                                        return (
                                            <div key={opt.idx} className={cls}>
                                                <span className="font-bold mr-3">{letter}.</span>
                                                <span className="flex-1">{text}</span>
                                                {opt.idx === correctIdx && (
                                                    <span className="ml-2 text-success font-bold text-xl" aria-label="Respuesta correcta">✓</span>
                                                )}
                                                {opt.idx === selectedOptionIdx && opt.idx !== correctIdx && (
                                                    <span className="ml-2 text-danger font-bold text-xl" aria-label="Respuesta incorrecta seleccionada">✗</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Unanswered Warning */}
                                {selectedOptionIdx === undefined && (
                                    <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-ink-light dark:text-slate-400 text-center text-sm font-medium border border-slate-200 dark:border-slate-700">
                                        {t('No respondiste a esta pregunta.', 'You did not answer this question.')}
                                    </div>
                                )}

                                {/* DGT Explanation */}
                                {helpHtml && (
                                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                                        <button
                                            onClick={() => toggleExplanation(idx)}
                                            className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                                            aria-expanded={showExplanationMap[idx]}
                                        >
                                            {showExplanationMap[idx] ? '▲' : '▼'}{' '}
                                            {t('Ver explicación del manual DGT', 'View DGT manual explanation')}
                                        </button>
                                        {showExplanationMap[idx] && (
                                            <div
                                                className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl help-html text-ink-light dark:text-slate-300 border border-blue-100 dark:border-blue-800 text-sm animate-fade-in"
                                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(helpHtml) }}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}

            {/* Expanded Image Modal */}
            {expandedImage && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                    onClick={() => setExpandedImage(null)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setExpandedImage(null) }}
                    role="dialog"
                    aria-label={t('Imagen ampliada', 'Expanded image')}
                    tabIndex={-1}
                >
                    <button 
                        className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl" 
                        onClick={() => setExpandedImage(null)} 
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                    <img
                        src={expandedImage}
                        alt={t('Imagen ampliada', 'Expanded image')}
                        className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain animate-scale-in"
                    />
                </div>
            )}
        </div>
    )
}

export default function ExamReviewPage() {
    return (
        <AppShell>
            <ReviewInterface />
        </AppShell>
    )
}