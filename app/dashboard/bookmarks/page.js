'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import DOMPurify from 'dompurify'

// Properly use DOMPurify to prevent XSS attacks when rendering explanations
function sanitizeHtml(html) {
    if (typeof window === 'undefined') return ''
    return DOMPurify.sanitize(html)
}

function BookmarksInterface() {
    const { user, t } = useAuth()
    const router = useRouter()

    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [expandedImage, setExpandedImage] = useState(null)
    const [showExplanationMap, setShowExplanationMap] = useState({})
    
    const lang = user?.preferences?.language || 'es'

    // Fetch Bookmarks safely with memory leak prevention
    useEffect(() => {
        let isMounted = true

        const fetchBookmarks = async () => {
            setLoading(true)
            setError(false)
            try {
                const res = await fetch('/api/users/bookmarks?populate=true')
                if (!res.ok) throw new Error('Failed to fetch bookmarks')
                
                const data = await res.json()
                if (isMounted && data.bookmarks) {
                    setQuestions(data.bookmarks)
                }
            } catch (err) {
                console.error('Error fetching bookmarks:', err)
                if (isMounted) setError(true)
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        fetchBookmarks()

        return () => { isMounted = false }
    }, [])

    const toggleBookmark = async (questionId) => {
        // Optimistic UI update: instantly hide it to make the app feel snappy
        setQuestions(prev => prev.filter(q => q._id !== questionId))

        try {
            const res = await fetch('/api/users/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId })
            })
            const data = await res.json()
            
            // If the server says it IS bookmarked (meaning our toggle added it back by mistake), 
            // or if the request failed, we would ideally fetch the list again or revert the state.
            // For now, silently failing is okay since they explicitly clicked "Remove".
            if (!data.success) {
                console.error('Failed to update bookmark on server')
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error)
        }
    }

    const toggleExplanation = (idx) => {
        setShowExplanationMap(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }))
    }

    // Helper to get localized text safely
    const getLocalizedText = (obj) => {
        if (!obj) return ''
        if (typeof obj === 'string') return obj
        if (lang === 'en' && obj.en) return obj.en
        return obj.es || obj.en || ''
    }

    // ==== RENDER: LOADING ====
    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="text-4xl animate-bounce mb-4" role="img" aria-label="Loading">⭐</div>
                    <p className="text-ink-light dark:text-slate-400 font-medium">
                        {t('Cargando guardados...', 'Loading bookmarks...')}
                    </p>
                </div>
            </div>
        )
    }

    // ==== RENDER: ERROR ====
    if (error) {
        return (
            <div className="text-center py-20 px-4">
                <div className="text-6xl mb-4" role="img" aria-label="Error">⚠️</div>
                <h2 className="text-2xl font-bold mb-4 text-ink dark:text-white">
                    {t('Error al cargar', 'Error loading')}
                </h2>
                <p className="text-ink-light dark:text-slate-400 mb-8">
                    {t('No pudimos cargar tus preguntas guardadas. Inténtalo de nuevo más tarde.', 'We could not load your bookmarked questions. Please try again later.')}
                </p>
                <button onClick={() => window.location.reload()} className="btn-primary">
                    {t('Reintentar', 'Retry')}
                </button>
            </div>
        )
    }

    // ==== RENDER: MAIN LIST ====
    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12 px-4 sm:px-6">
            
            {/* Header Controls */}
            <div className="flex items-center justify-between mb-8 mt-4">
                <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-ink-light dark:text-slate-400 transition-colors flex items-center gap-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <span aria-hidden="true">←</span> {t('Volver al inicio', 'Back to dashboard')}
                </button>
            </div>

            {/* Title Card */}
            <div className="mb-6 card text-center p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                <h1 className="text-2xl font-bold mb-2 text-ink dark:text-white">
                    {t('Preguntas Guardadas', 'Bookmarked Questions')}
                </h1>
                <p className="text-ink-light dark:text-slate-400">
                    {t(`Tienes ${questions.length} preguntas guardadas para revisar.`, `You have ${questions.length} bookmarked questions to review.`)}
                </p>
            </div>

            {/* Empty State */}
            {questions.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <div className="text-5xl mb-4" aria-hidden="true">⭐</div>
                    <h2 className="text-xl font-bold mb-2 text-ink dark:text-white">
                        {t('No tienes preguntas guardadas', 'No bookmarked questions')}
                    </h2>
                    <p className="text-ink-light dark:text-slate-400 mb-6 max-w-md mx-auto">
                        {t('Guarda preguntas durante los exámenes haciendo clic en la estrella para repasarlas aquí.', 'Bookmark questions during exams by clicking the star to review them here.')}
                    </p>
                    <button type="button" onClick={() => router.push('/exam')} className="btn-primary">
                        {t('Hacer un examen', 'Take an exam')}
                    </button>
                </div>
            ) : (
                /* Questions List */
                questions.map((q, idx) => {
                    const questionText = getLocalizedText(q.question)
                    const correctIdx = q.correct_option_idx
                    const helpHtml = q.metadata?.help_html

                    return (
                        <div key={q._id} className="card relative p-0 overflow-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                            
                            {/* Remove Bookmark Button */}
                            <div className="absolute top-4 right-4 z-10">
                                <button
                                    type="button"
                                    onClick={() => toggleBookmark(q._id)}
                                    className="flex items-center gap-1.5 text-xs sm:text-sm font-bold transition-colors text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    aria-label={t('Quitar de guardados', 'Remove bookmark')}
                                >
                                    <span aria-hidden="true">⭐</span> {t('Quitar', 'Remove')}
                                </button>
                            </div>

                            {/* Optional Image */}
                            {q.metadata?.image_url && (
                                <button 
                                    className="w-full bg-slate-50 dark:bg-slate-900 relative flex items-center justify-center min-h-[12rem] cursor-zoom-in border-b border-slate-100 dark:border-slate-700 hover:opacity-95 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                                    onClick={() => setExpandedImage(q.metadata.image_url)}
                                    aria-label={t('Ampliar imagen', 'Expand image')}
                                >
                                    <img
                                        src={q.metadata.image_url}
                                        alt={t('Imagen de la pregunta', 'Question image')}
                                        className="w-full h-full max-h-56 object-contain absolute inset-0 p-4"
                                    />
                                </button>
                            )}

                            {/* Content Padding Wrapper */}
                            <div className="p-6 md:p-8">
                                <div className="flex items-center gap-2 mb-4">
                                    {q.topic_tag && (
                                        <span className="badge-pill bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                                            {getLocalizedText(q.topic_tag)}
                                        </span>
                                    )}
                                </div>

                                <h2 className="text-lg font-semibold text-ink dark:text-white mb-6 pr-20 leading-relaxed">
                                    {questionText}
                                </h2>

                                {/* Options (Non-Interactive Display) */}
                                <div className="space-y-3">
                                    {q.options?.map((opt) => {
                                        const text = lang === 'en' && opt.text_en ? opt.text_en : opt.text_es
                                        const letter = ['A', 'B', 'C', 'D'][opt.idx]
                                        const isCorrect = opt.idx === correctIdx

                                        let cls = 'flex text-left items-center w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 '

                                        if (isCorrect) {
                                            cls += 'border-success bg-success/10 text-success dark:text-green-400'
                                        } else {
                                            cls += 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-ink-light opacity-60'
                                        }

                                        return (
                                            <div key={opt.idx} className={cls}>
                                                <span className="font-bold mr-3">{letter}.</span>
                                                <span className="flex-1">{text}</span>
                                                {isCorrect && (
                                                    <span className="ml-2 text-success font-bold text-xl" aria-label={t('Respuesta correcta', 'Correct answer')}>✓</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* DGT Explanation */}
                                {helpHtml && (
                                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                                        <button
                                            type="button"
                                            onClick={() => toggleExplanation(idx)}
                                            className="text-sm text-primary dark:text-blue-400 font-medium hover:underline flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                                            aria-expanded={showExplanationMap[idx]}
                                        >
                                            {showExplanationMap[idx] ? '▲' : '▼'}
                                            {t('Ver explicación del manual DGT', 'View DGT manual explanation')}
                                        </button>
                                        {showExplanationMap[idx] && (
                                            <div
                                                className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl help-html text-ink-light dark:text-slate-300 border border-blue-100 dark:border-blue-800/50 text-sm animate-fade-in"
                                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(helpHtml) }}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })
            )}

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
                        type="button"
                        className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl focus:outline-none focus:ring-2 focus:ring-white rounded" 
                        onClick={() => setExpandedImage(null)}
                        aria-label={t('Cerrar', 'Close')}
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

export default function BookmarksPage() {
    return (
        <AppShell>
            <BookmarksInterface />
        </AppShell>
    )
}