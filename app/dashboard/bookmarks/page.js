'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth, AuthProvider } from '@/components/AuthContext'

function sanitizeHtml(html) {
    if (typeof window === 'undefined') return ''
    const div = document.createElement('div')
    div.innerHTML = html
    div.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove())
    return div.innerHTML
}

function BookmarksInterface() {
    const { user, t } = useAuth()
    const router = useRouter()

    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [lang, setLang] = useState(user?.preferences?.language || 'es')
    const [expandedImage, setExpandedImage] = useState(null)
    const [showExplanationMap, setShowExplanationMap] = useState({})

    useEffect(() => {
        fetchBookmarks()
    }, [])

    const fetchBookmarks = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/users/bookmarks?populate=true')
            const data = await res.json()
            if (data.bookmarks) {
                setQuestions(data.bookmarks)
            }
        } catch (error) {
            console.error('Error fetching bookmarks:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleBookmark = async (questionId) => {
        try {
            const res = await fetch('/api/users/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId })
            })
            const data = await res.json()
            if (data.success && !data.isBookmarked) {
                // Remove from list if unbookmarked
                setQuestions(prev => prev.filter(q => q._id !== questionId))
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="text-4xl animate-bounce mb-4">⭐</div>
                    <p className="text-ink-light">{t('Cargando guardados...', 'Loading bookmarks...')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="p-2 rounded-lg hover:bg-slate-100 text-ink-light flex items-center gap-2 font-medium"
                >
                    <span>←</span> {t('Volver al inicio', 'Back to dashboard')}
                </button>
            </div>

            <div className="mb-6 card text-center p-6 border-slate-200">
                <h1 className="text-2xl font-bold mb-2 text-ink">
                    {t('Preguntas Guardadas', 'Bookmarked Questions')}
                </h1>
                <p className="text-ink-light">
                    {t(`Tienes ${questions.length} preguntas guardadas para revisar.`, `You have ${questions.length} bookmarked questions to review.`)}
                </p>
            </div>

            {questions.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="text-5xl mb-4">⭐</div>
                    <h2 className="text-xl font-bold mb-2 text-ink">{t('No tienes preguntas guardadas', 'No bookmarked questions')}</h2>
                    <p className="text-ink-light mb-6">
                        {t('Guarda preguntas durante los exámenes para repasarlas aquí.', 'Bookmark questions during exams to review them here.')}
                    </p>
                    <button onClick={() => router.push('/exam')} className="btn-primary">
                        {t('Hacer un examen', 'Take an exam')}
                    </button>
                </div>
            ) : (
                questions.map((q, idx) => {
                    const questionText = lang === 'en' ? q.question?.en : q.question?.es
                    const correctIdx = q.correct_option_idx
                    const helpHtml = q.metadata?.help_html

                    return (
                        <div key={q._id} className="card relative">
                            <div className="absolute top-4 right-4 flex items-center gap-3">
                                <button
                                    onClick={() => toggleBookmark(q._id)}
                                    className="flex items-center gap-1 text-sm font-medium transition-colors text-amber-500 hover:text-amber-600 bg-amber-50 px-3 py-1 rounded-lg"
                                >
                                    ⭐ {t('Quitar', 'Remove')}
                                </button>
                            </div>

                            {/* Image */}
                            {q.metadata?.image_url && (
                                <div className="mb-4 -mx-6 -mt-6">
                                    <img
                                        src={q.metadata.image_url}
                                        alt="Question image"
                                        className="w-full rounded-t-2xl max-h-48 object-contain bg-slate-50 cursor-zoom-in"
                                        onClick={() => setExpandedImage(q.metadata.image_url)}
                                    />
                                </div>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                                {q.topic_tag && (
                                    <span className="badge-pill bg-slate-100 text-ink-light text-xs">{q.topic_tag}</span>
                                )}
                            </div>

                            <h2 className="text-lg font-semibold text-ink mb-6 pr-24 leading-relaxed">
                                {questionText}
                            </h2>

                            {/* Options */}
                            <div className="space-y-3">
                                {q.options?.map((opt) => {
                                    const text = lang === 'en' ? opt.text_en : opt.text_es
                                    const letter = ['A', 'B', 'C', 'D'][opt.idx]

                                    let cls = 'option-btn pointer-events-none'

                                    if (opt.idx === correctIdx) {
                                        cls += ' correct border-success bg-green-50'
                                    }

                                    return (
                                        <div key={opt.idx} className={cls}>
                                            <span className="font-bold mr-3">{letter}.</span>
                                            <span className="flex-1">{text}</span>
                                            {opt.idx === correctIdx && (
                                                <span className="ml-2 text-success font-bold text-xl">✓</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Explanation */}
                            {helpHtml && (
                                <div className="mt-6 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={() => toggleExplanation(idx)}
                                        className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                                    >
                                        {showExplanationMap[idx] ? '▲' : '▼'}{' '}
                                        {t('Ver explicación del manual DGT', 'View DGT manual explanation')}
                                    </button>
                                    {showExplanationMap[idx] && (
                                        <div
                                            className="mt-3 p-4 bg-blue-50 rounded-xl help-html text-ink-light border border-blue-100 text-sm"
                                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(helpHtml) }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })
            )}

            {/* Expanded image modal */}
            {expandedImage && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
                    onClick={() => setExpandedImage(null)}
                >
                    <img
                        src={expandedImage}
                        alt="Expanded"
                        className="max-w-full max-h-full rounded-2xl shadow-2xl"
                    />
                </div>
            )}
        </div>
    )
}

export default function BookmarksPage() {
    return (
        <AuthProvider>
            <AppShell>
                <div className="min-h-screen bg-canvas">
                    <main className="max-w-3xl mx-auto px-4 py-6">
                        <BookmarksInterface />
                    </main>
                </div>
            </AppShell>
        </AuthProvider>
    )
}
