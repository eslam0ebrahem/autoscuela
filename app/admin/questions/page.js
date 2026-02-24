'use client'
import { useState, useEffect, useRef } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function AdminQuestionsContent() {
  const { t } = useAuth()
  const [questions, setQuestions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [importJson, setImportJson] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [editingQ, setEditingQ] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const fileRef = useRef()

  const fetchQuestions = () => {
    setLoading(true)
    fetch(`/api/admin/questions?page=${page}&search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => { setQuestions(d.questions || []); setTotal(d.total || 0); setLoading(false) })
  }

  useEffect(() => { fetchQuestions() }, [page, search])

  const handleImport = async () => {
    if (!importJson.trim()) return
    setImporting(true)
    setImportResult(null)
    try {
      const parsed = JSON.parse(importJson)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: arr }),
      })
      const data = await res.json()
      setImportResult(data)
      setImportJson('')
      fetchQuestions()
    } catch (e) {
      setImportResult({ error: e.message })
    }
    setImporting(false)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImportJson(ev.target.result)
    reader.readAsText(file)
  }

  const handleDelete = async (id) => {
    if (!confirm(t('¿Desactivar esta pregunta?', 'Deactivate this question?'))) return
    await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' })
    fetchQuestions()
  }

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    await fetch(`/api/admin/questions/${editingQ._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingQ),
    })
    setSavingEdit(false)
    setEditingQ(null)
    fetchQuestions()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">📝 {t('Preguntas del Examen', 'Exam Questions')}</h1>
          <p className="text-ink-light text-sm">{total} {t('preguntas en total', 'total questions')}</p>
        </div>
      </div>

      {/* JSON Import */}
      <div className="card border border-blue-200 bg-blue-50">
        <h2 className="font-bold text-ink mb-3">⬆️ {t('Importar desde JSON', 'Import from JSON')}</h2>
        <p className="text-sm text-ink-light mb-3">
          {t('Pega un array JSON de preguntas o sube el archivo directamente desde tu exportación de MongoDB', 'Paste a JSON array of questions or upload the file directly from your MongoDB export')}
        </p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileRef}
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current.click()}
              className="btn-secondary text-sm"
            >
              📁 {t('Subir archivo .json', 'Upload .json file')}
            </button>
          </div>
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder={`[{"exam_id": 1, "question_number": 1, "question": {"es": "...", "en": "..."}, "options": [...], "correct_option_idx": 0, "metadata": {"help_html": "..."}}]`}
            className="input font-mono text-xs h-28 resize-y"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={importing || !importJson.trim()}
              className="btn-primary"
            >
              {importing ? t('Importando...', 'Importing...') : `${t('Importar', 'Import')} →`}
            </button>
            {importResult && (
              <div className={`text-sm font-medium ${importResult.error ? 'text-danger' : 'text-success'}`}>
                {importResult.error
                  ? `❌ ${importResult.error}`
                  : `✅ ${importResult.inserted} ${t('importadas', 'imported')}`
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder={t('Buscar preguntas...', 'Search questions...')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="input flex-1"
        />
      </div>

      {/* Questions table */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-ink-light uppercase tracking-wide">
                    {t('Examen / Nº', 'Exam / #')}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-ink-light uppercase tracking-wide">
                    {t('Pregunta (ES)', 'Question (ES)')}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-ink-light uppercase tracking-wide">
                    {t('Tema', 'Topic')}
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-ink-light uppercase tracking-wide">
                    {t('Acciones', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questions.map((q) => (
                  <tr key={q._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-ink-light whitespace-nowrap">
                      {q.exam_id}-{q.question_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink max-w-xs truncate">
                      {q.question?.es}
                    </td>
                    <td className="px-4 py-3">
                      {q.topic_tag && (
                        <span className="badge-pill bg-slate-100 text-ink-light text-xs">{q.topic_tag}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingQ({ ...q })}
                          className="text-primary hover:underline text-sm font-medium"
                        >
                          {t('Editar', 'Edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(q._id)}
                          className="text-danger hover:underline text-sm font-medium"
                        >
                          {t('Borrar', 'Delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 flex items-center justify-between border-t border-slate-200">
            <span className="text-sm text-ink-light">
              {t('Página', 'Page')} {page} — {Math.min(page * 20, total)} / {total}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">
                ←
              </button>
              <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">
                →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-ink">{t('Editar Pregunta', 'Edit Question')}</h2>
              <button onClick={() => setEditingQ(null)} className="text-ink-light hover:text-ink">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">{t('Pregunta (Español)', 'Question (Spanish)')}</label>
                <textarea
                  value={editingQ.question?.es || ''}
                  onChange={(e) => setEditingQ(q => ({ ...q, question: { ...q.question, es: e.target.value } }))}
                  className="input h-20 resize-y"
                />
              </div>
              <div>
                <label className="label">{t('Pregunta (English)', 'Question (English)')}</label>
                <textarea
                  value={editingQ.question?.en || ''}
                  onChange={(e) => setEditingQ(q => ({ ...q, question: { ...q.question, en: e.target.value } }))}
                  className="input h-20 resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('Respuesta correcta (idx)', 'Correct answer (idx)')}</label>
                  <input
                    type="number" min="0" max="3"
                    value={editingQ.correct_option_idx}
                    onChange={(e) => setEditingQ(q => ({ ...q, correct_option_idx: parseInt(e.target.value) }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">{t('Tema', 'Topic tag')}</label>
                  <input
                    type="text"
                    value={editingQ.topic_tag || ''}
                    onChange={(e) => setEditingQ(q => ({ ...q, topic_tag: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">Help HTML</label>
                <textarea
                  value={editingQ.metadata?.help_html || ''}
                  onChange={(e) => setEditingQ(q => ({ ...q, metadata: { ...q.metadata, help_html: e.target.value } }))}
                  className="input h-32 resize-y font-mono text-xs"
                />
              </div>
              <div>
                <label className="label">{t('URL Imagen', 'Image URL')}</label>
                <input
                  type="text"
                  value={editingQ.metadata?.image_url || ''}
                  onChange={(e) => setEditingQ(q => ({ ...q, metadata: { ...q.metadata, image_url: e.target.value } }))}
                  className="input"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingQ(null)} className="btn-secondary flex-1">
                {t('Cancelar', 'Cancel')}
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary flex-1">
                {savingEdit ? t('Guardando...', 'Saving...') : t('Guardar cambios', 'Save changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminQuestionsPage() {
  return (
    <AppShell requireAdmin>
      <AdminQuestionsContent />
    </AppShell>
  )
}
