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
  const [showImport, setShowImport] = useState(false)
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

  const totalPages = Math.ceil(total / 20)

  // ── FIELD HELPER ──────────────────────────────────────────
  const Field = ({ label, children }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-base-content/50 uppercase tracking-wide block">
        {label}
      </label>
      {children}
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 space-y-5">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            📝 {t('Preguntas del Examen', 'Exam Questions')}
          </h1>
          <p className="text-sm text-base-content/50 mt-0.5">
            {total} {t('preguntas en total', 'total questions')}
          </p>
        </div>
        <button
          onClick={() => { setShowImport(p => !p); setImportResult(null) }}
          className={`btn btn-sm h-10 rounded-xl gap-2 shrink-0
            ${showImport ? 'btn-ghost border border-base-300' : 'btn-primary'}`}
        >
          {showImport ? '✕' : '⬆️'} {showImport ? t('Cerrar', 'Close') : t('Importar', 'Import')}
        </button>
      </div>

      {/* ── JSON Import Panel ── */}
      {showImport && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">⬆️</span>
            <h2 className="font-black text-sm text-base-content">
              {t('Importar desde JSON', 'Import from JSON')}
            </h2>
          </div>
          <p className="text-xs text-base-content/50 leading-relaxed">
            {t(
              'Pega un array JSON de preguntas o sube el archivo directamente desde tu exportación de MongoDB.',
              'Paste a JSON array of questions or upload the file directly from your MongoDB export.'
            )}
          </p>

          <input type="file" ref={fileRef} accept=".json" onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileRef.current.click()}
            className="btn btn-outline btn-sm rounded-xl gap-2"
          >
            📁 {t('Subir archivo .json', 'Upload .json file')}
          </button>

          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder={`[{"exam_id": 1, "question_number": 1, "question": {"es": "...", "en": "..."}, ...}]`}
            className="textarea textarea-bordered w-full rounded-xl font-mono text-xs h-28 resize-y bg-base-100"
          />

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleImport}
              disabled={importing || !importJson.trim()}
              className="btn btn-primary btn-sm rounded-xl h-10 gap-2 disabled:opacity-40"
            >
              {importing
                ? <><span className="loading loading-spinner loading-xs" /> {t('Importando...', 'Importing...')}</>
                : `${t('Importar', 'Import')} →`}
            </button>
            {importResult && (
              <span className={`text-sm font-bold ${importResult.error ? 'text-error' : 'text-success'}`}>
                {importResult.error
                  ? `❌ ${importResult.error}`
                  : `✅ ${importResult.inserted} ${t('importadas', 'imported')}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 text-sm pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          placeholder={t('Buscar preguntas...', 'Search questions...')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="input input-bordered w-full rounded-xl pl-9 bg-base-100"
        />
      </div>

      {/* ── Questions Table ── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-base-200 animate-pulse" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-base-300 p-12 text-center">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm text-base-content/50">
            {t('No se encontraron preguntas.', 'No questions found.')}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-base-200 bg-base-100 overflow-hidden shadow-sm">

          {/* Desktop table — hidden on very small screens */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-base-200/60 border-b border-base-200">
                <tr>
                  {[
                    t('Examen / Nº', 'Exam / #'),
                    t('Pregunta (ES)', 'Question (ES)'),
                    t('Tema', 'Topic'),
                    t('Acciones', 'Actions'),
                  ].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-[11px] font-black text-base-content/50 uppercase tracking-wide
                        ${i === 3 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200">
                {questions.map((q) => (
                  <tr key={q._id} className="hover:bg-base-50 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs text-base-content/50 whitespace-nowrap">
                      {q.exam_id}-{q.question_number}
                    </td>
                    <td className="px-4 py-3 text-base-content max-w-xs truncate">
                      {q.question?.es}
                    </td>
                    <td className="px-4 py-3">
                      {q.topic_tag && (
                        <span className="px-2 py-0.5 rounded-full bg-base-200 text-base-content/60 text-[11px] font-bold">
                          {q.topic_tag.es}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingQ({ ...q })}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          {t('Editar', 'Edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(q._id)}
                          className="text-xs font-bold text-error hover:underline"
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

          {/* Mobile card list — shown only on xs screens */}
          <div className="sm:hidden divide-y divide-base-200">
            {questions.map((q) => (
              <div key={q._id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-base-content/40">
                    {q.exam_id}-{q.question_number}
                  </span>
                  {q.topic_tag && (
                    <span className="px-2 py-0.5 rounded-full bg-base-200 text-base-content/60 text-[10px] font-bold">
                      {q.topic_tag.es}
                    </span>
                  )}
                </div>
                <p className="text-sm text-base-content line-clamp-2">{q.question?.es}</p>
                <div className="flex gap-4 pt-1">
                  <button
                    onClick={() => setEditingQ({ ...q })}
                    className="text-xs font-bold text-primary"
                  >
                    {t('Editar', 'Edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(q._id)}
                    className="text-xs font-bold text-error"
                  >
                    {t('Borrar', 'Delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 flex items-center justify-between border-t border-base-200 bg-base-50">
            <span className="text-xs text-base-content/50">
              {t('Página', 'Page')} {page} / {totalPages || 1} — {Math.min(page * 20, total)} / {total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="btn btn-ghost btn-xs rounded-lg disabled:opacity-30"
              >
                ←
              </button>
              <button
                disabled={page * 20 >= total}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-ghost btn-xs rounded-lg disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingQ && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
            bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingQ(null) }}
        >
          <div className="bg-base-100 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-3xl
            max-h-[92vh] overflow-y-auto shadow-2xl">

            {/* Modal header */}
            <div className="sticky top-0 bg-base-100 border-b border-base-200 px-5 py-4
              flex items-center justify-between z-10 rounded-t-3xl sm:rounded-t-2xl">
              <h2 className="font-black text-base text-base-content">
                {t('Editar Pregunta', 'Edit Question')}
              </h2>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-base-content/40">
                  {editingQ.exam_id}-{editingQ.question_number}
                </span>
                <button
                  onClick={() => setEditingQ(null)}
                  className="w-8 h-8 rounded-xl bg-base-200 flex items-center justify-center
                    text-base-content/60 hover:bg-base-300 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">

              {/* Question text */}
              <Field label={t('Pregunta (Español)', 'Question (Spanish)')}>
                <textarea
                  value={editingQ.question?.es || ''}
                  onChange={(e) => setEditingQ(q => ({ ...q, question: { ...q.question, es: e.target.value } }))}
                  className="textarea textarea-bordered w-full rounded-xl h-20 resize-y bg-base-100 text-sm"
                />
              </Field>

              <Field label={t('Pregunta (English)', 'Question (English)')}>
                <textarea
                  value={editingQ.question?.en || ''}
                  onChange={(e) => setEditingQ(q => ({ ...q, question: { ...q.question, en: e.target.value } }))}
                  className="textarea textarea-bordered w-full rounded-xl h-20 resize-y bg-base-100 text-sm"
                />
              </Field>

              {/* Correct idx + topic */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('Respuesta correcta (idx)', 'Correct answer (idx)')}>
                  <input
                    type="number" min="0" max="3"
                    value={editingQ.correct_option_idx}
                    onChange={(e) => setEditingQ(q => ({ ...q, correct_option_idx: parseInt(e.target.value) }))}
                    className="input input-bordered input-sm w-full rounded-xl bg-base-100"
                  />
                </Field>
                <Field label={t('Tema (ES)', 'Topic (ES)')}>
                  <input
                    type="text"
                    value={editingQ.topic_tag?.es || ''}
                    onChange={(e) => setEditingQ(q => ({ ...q, topic_tag: { ...q.topic_tag, es: e.target.value } }))}
                    className="input input-bordered input-sm w-full rounded-xl bg-base-100"
                  />
                </Field>
              </div>

              <Field label={t('Tema (EN)', 'Topic (EN)')}>
                <input
                  type="text"
                  value={editingQ.topic_tag?.en || ''}
                  onChange={(e) => setEditingQ(q => ({ ...q, topic_tag: { ...q.topic_tag, en: e.target.value } }))}
                  className="input input-bordered input-sm w-full rounded-xl bg-base-100"
                />
              </Field>

              <Field label="Help HTML">
                <textarea
                  value={editingQ.metadata?.help_html || ''}
                  onChange={(e) => setEditingQ(q => ({ ...q, metadata: { ...q.metadata, help_html: e.target.value } }))}
                  className="textarea textarea-bordered w-full rounded-xl h-32 resize-y font-mono text-xs bg-base-100"
                />
              </Field>

              <Field label={t('URL Imagen', 'Image URL')}>
                <input
                  type="text"
                  value={editingQ.metadata?.image_url || ''}
                  onChange={(e) => setEditingQ(q => ({ ...q, metadata: { ...q.metadata, image_url: e.target.value } }))}
                  className="input input-bordered input-sm w-full rounded-xl bg-base-100"
                />
                {editingQ.metadata?.image_url && (
                  <img
                    src={editingQ.metadata.image_url}
                    alt="Preview"
                    className="mt-2 max-h-32 rounded-xl object-contain border border-base-200"
                  />
                )}
              </Field>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-base-100 border-t border-base-200 px-5 py-4 flex gap-3">
              <button
                onClick={() => setEditingQ(null)}
                className="btn btn-ghost btn-sm h-11 flex-1 rounded-xl border border-base-300"
              >
                {t('Cancelar', 'Cancel')}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="btn btn-primary btn-sm h-11 flex-1 rounded-xl disabled:opacity-40"
              >
                {savingEdit
                  ? <><span className="loading loading-spinner loading-xs" /> {t('Guardando...', 'Saving...')}</>
                  : t('Guardar cambios', 'Save changes')}
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
