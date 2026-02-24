'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth, AuthProvider } from '@/components/AuthContext'
import AppShell from '@/components/AppShell'

function sanitizeHtml(html) {
    if (typeof window === 'undefined') return ''
    // Basic sanitization
    const div = document.createElement('div')
    div.innerHTML = html
    div.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove())
    return div.innerHTML
}

function ReviewInterface() {
    const { user, t } = useAuth()
    const params = useParams()
    const router = useRouter()
    const sessionId = params.sessionId

    const [session, setSession] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [lang, setLang] = useState(user?.preferences?.language || 'es')
    const [expandedImage, setExpandedImage] = useState(null)
    const [showExplanationMap, setShowExplanationMap] = useState({})

    useEffect(() => {
        fetch(`/api/exams/${sessionId}`)
            .then((r) => r.json())
            .then((data) => {
                setSession(data.session)
                setQuestions(data.questions)
                setLoading(false)
            })
    }, [sessionId])

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
                    <div className="text-4xl animate-bounce mb-4">🔍</div>
                    <p className="text-ink-light">{t('Cargando revisión...', 'Loading review...')}</p>
                </div>
            </div>
        )
    }

    if (!session || !questions?.length) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold mb-4">{t('Examen no encontrado', 'Exam not found')}</h2>
                <button onClick={() => router.push('/exam')} className="btn-primary">
                    {t('Atrás', 'Back')}
                </button>
            </div>
        )
    }

    const answerMap = {}
    session.answers?.forEach(a => {
        answerMap[a.questionId] = a
    })

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => router.push(`/exam/${sessionId}`)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-ink-light flex items-center gap-2 font-medium"
                >
                    <span>←</span> {t('Volver al examen', 'Back to exam result')}
                </button>

            </div>

            <div className="mb-6 card text-center p-6 border-slate-200">
                <h1 className="text-2xl font-bold mb-2 text-ink">
                    {t('Revisión del Examen', 'Exam Review')}
                </h1>
                <div className="flex justify-center gap-6 mt-4">
                    <div className="bg-slate-50 rounded-xl p-4 w-24">
                        <div className="text-3xl font-bold text-success">{session.score || 0}</div>
                        <div className="text-xs text-ink-light">{t('Correctas', 'Correct')}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 w-24">
                        <div className="text-3xl font-bold text-danger">{session.errorCount || 0}</div>
                        <div className="text-xs text-ink-light">{t('Errores', 'Errors')}</div>
                    </div>
                </div>
            </div>

            {questions.map((q, idx) => {
                const questionText = lang === 'en' ? q.question?.en : q.question?.es
                const userAnswer = answerMap[q._id]
                const selectedOptionIdx = userAnswer?.selectedOptionIdx
                const correctIdx = q.correct_option_idx
                const helpHtml = q.metadata?.help_html

                return (
                    <div key={q._id} className="card relative">
                        <div className="absolute top-4 right-4 text-sm font-bold text-ink-light bg-slate-100 px-3 py-1 rounded-lg">
                            {idx + 1} / {questions.length}
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

                        <h2 className="text-lg font-semibold text-ink mb-6 pr-14 leading-relaxed">
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
                                } else if (opt.idx === selectedOptionIdx && selectedOptionIdx !== correctIdx) {
                                    cls += ' incorrect border-danger bg-red-50'
                                }

                                return (
                                    <div key={opt.idx} className={cls}>
                                        <span className="font-bold mr-3">{letter}.</span>
                                        <span className="flex-1">{text}</span>
                                        {opt.idx === correctIdx && (
                                            <span className="ml-2 text-success font-bold text-xl">✓</span>
                                        )}
                                        {opt.idx === selectedOptionIdx && opt.idx !== correctIdx && (
                                            <span className="ml-2 text-danger font-bold text-xl">✗</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* If user didn't answer */}
                        {selectedOptionIdx === undefined && (
                            <div className="mt-4 p-3 bg-slate-100 rounded-lg text-ink-light text-center text-sm font-medium">
                                {t('No respondiste a esta pregunta.', 'You did not answer this question.')}
                            </div>
                        )}

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
            })}

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

export default function ExamReviewPage() {
    return (
        <AuthProvider>
            <AppShell>
                <div className="min-h-screen bg-canvas">
                    <main className="max-w-3xl mx-auto px-4 py-6">
                        <ReviewInterface />
                    </main>
                </div>
            </AppShell>
        </AuthProvider>
    )
}
