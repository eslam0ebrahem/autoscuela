'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import {
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseOutlined,
  SaveOutlined,
  PlusOutlined,
  FilterOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Debounce Hook
// ---------------------------------------------------------------------------
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// ---------------------------------------------------------------------------
// Admin Questions Content
// ---------------------------------------------------------------------------
function AdminQuestionsContent() {
  const { t } = useAuth()
  const { showToast } = useToast()
  const fileRef = useRef()

  // ── State ──────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')

  const [importJson, setImportJson] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const [editingQ, setEditingQ] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const debouncedSearch = useDebounce(search, 500)

  // ── Fetch questions ────────────────────────────────────────────────────
  const fetchQuestions = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: page.toString(),
      search: debouncedSearch,
      ...(topicFilter && { topic: topicFilter }),
      ...(activeFilter !== '' && { active: activeFilter }),
    })

    fetch(`/api/admin/questions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setQuestions(d.questions || [])
        setTotal(d.total || 0)
      })
      .catch((err) => {
        console.error('[admin/questions] Fetch error:', err)
        showToast(
          t('Error al cargar preguntas', 'Error loading questions'),
          'error'
        )
      })
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, topicFilter, activeFilter, t, showToast])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  // ── Import JSON ────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importJson.trim()) {
      showToast(t('El JSON está vacío', 'JSON is empty'), 'error')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const parsed = JSON.parse(importJson)
      const arr = Array.isArray(parsed) ? parsed : [parsed]

      if (arr.length === 0) {
        showToast(t('No hay preguntas para importar', 'No questions to import'), 'error')
        setImporting(false)
        return
      }

      if (arr.length > 500) {
        showToast(t('Máximo 500 preguntas por importación', 'Maximum 500 questions per import'), 'error')
        setImporting(false)
        return
      }

      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: arr }),
      })

      const data = await res.json()

      if (res.ok) {
        setImportResult(data)
        setImportJson('')
        showToast(
          t(
            `Importadas: ${data.inserted}, Actualizadas: ${data.updated}`,
            `Imported: ${data.inserted}, Updated: ${data.updated}`
          ),
          'success'
        )
        fetchQuestions()
      } else {
        throw new Error(data.error || 'Import failed')
      }
    } catch (e) {
      console.error('[admin/questions] Import error:', e)
      setImportResult({ error: e.message })
      showToast(
        t('Error al importar: ' + e.message, 'Import error: ' + e.message),
        'error'
      )
    } finally {
      setImporting(false)
    }
  }

  // ── File upload ────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      showToast(t('Solo archivos JSON', 'JSON files only'), 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setImportJson(ev.target.result)
      showToast(t('Archivo cargado', 'File loaded'), 'success')
    }
    reader.onerror = () => {
      showToast(t('Error al leer archivo', 'Error reading file'), 'error')
    }
    reader.readAsText(file)
  }

  // ── Export questions ───────────────────────────────────────────────────
  const exportQuestions = () => {
    const json = JSON.stringify(questions, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vialia-questions-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    showToast(t('Preguntas exportadas', 'Questions exported'), 'success')
  }

  // ── Delete question ────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm(t('¿Desactivar esta pregunta?', 'Deactivate this question?'))) {
      return
    }

    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        showToast(t('Pregunta desactivada', 'Question deactivated'), 'success')
        fetchQuestions()
      } else {
        throw new Error('Delete failed')
      }
    } catch (err) {
      console.error('[admin/questions] Delete error:', err)
      showToast(
        t('Error al desactivar', 'Error deactivating'),
        'error'
      )
    }
  }

  // ── Save edit ──────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    setSavingEdit(true)

    try {
      const res = await fetch(`/api/admin/questions/${editingQ._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingQ),
      })

      if (res.ok) {
        showToast(t('Pregunta actualizada', 'Question updated'), 'success')
        setEditingQ(null)
        fetchQuestions()
      } else {
        throw new Error('Update failed')
      }
    } catch (err) {
      console.error('[admin/questions] Save error:', err)
      showToast(
        t('Error al guardar', 'Error saving'),
        'error'
      )
    } finally {
      setSavingEdit(false)
    }
  }

  const totalPages = Math.ceil(total / 20)

  // ── Field Helper ───────────────────────────────────────────────────────
  const Field = ({ label, children }) => (
    <div className="mb-4">
      <label className="block text-sm font-bold text-ink dark:text-white mb-1">
        {label}
      </label>
      {children}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-black text-ink dark:text-white mb-2 flex items-center gap-2">
          <FileTextOutlined />
          {t('Gestión de Preguntas', 'Question Management')}
        </h1>
        <p className="text-ink-light dark:text-slate-400">
          {total} {t('preguntas en total', 'total questions')}
        </p>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light dark:text-slate-400" />
          <input
            type="text"
            placeholder={t('Buscar preguntas...', 'Search questions...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-ink dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-ink dark:text-white focus:ring-2 focus:ring-primary"
        >
          <option value="">{t('Todas', 'All')}</option>
          <option value="true">{t('Activas', 'Active')}</option>
          <option value="false">{t('Inactivas', 'Inactive')}</option>
        </select>

        <button
          onClick={fetchQuestions}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <ReloadOutlined className={loading ? 'animate-spin' : ''} />
          {t('Recargar', 'Reload')}
        </button>

        <button
          onClick={() => setShowImport(!showImport)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <UploadOutlined />
          {t('Importar', 'Import')}
        </button>

        <button
          onClick={exportQuestions}
          disabled={questions.length === 0}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <DownloadOutlined />
          {t('Exportar', 'Export')}
        </button>
      </div>

      {/* ── Import Section ────────────────────────────────────────────── */}
      {showImport && (
        <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-ink dark:text-white">
              {t('Importar Preguntas JSON', 'Import JSON Questions')}
            </h2>
            <button
              onClick={() => setShowImport(false)}
              className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
            >
              <CloseOutlined />
            </button>
          </div>

          <p className="text-sm text-ink-light dark:text-slate-400">
            {t(
              'Pega un array JSON de preguntas o sube el archivo directamente desde tu exportación de MongoDB.',
              'Paste a JSON array of questions or upload the file directly from your MongoDB export.'
            )}
          </p>

          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <UploadOutlined />
              {t('Subir archivo JSON', 'Upload JSON file')}
            </button>
          </div>

          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"exam_id": "B", "question_number": 1, ...}]'
            className="w-full h-48 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-ink dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary"
          />

          <button
            onClick={handleImport}
            disabled={importing || !importJson.trim()}
            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                {t('Importando...', 'Importing...')}
              </>
            ) : (
              <>
                <UploadOutlined />
                {t('Importar Preguntas', 'Import Questions')}
              </>
            )}
          </button>

          {importResult && (
            <div
              className={`p-4 rounded-lg ${
                importResult.error
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                  : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
              }`}
            >
              {importResult.error ? (
                <p className="font-bold">{importResult.error}</p>
              ) : (
                <div>
                  <p className="font-bold mb-2">
                    {t('Importación exitosa:', 'Import successful:')}
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>✅ {t('Insertadas:', 'Inserted:')} {importResult.inserted}</li>
                    <li>🔄 {t('Actualizadas:', 'Updated:')} {importResult.updated}</li>
                    {importResult.errors?.length > 0 && (
                      <li className="text-amber-700 dark:text-amber-400">
                        ⚠️ {t('Errores:', 'Errors:')} {importResult.errors.length}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Questions Table ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-ink-light dark:text-slate-400">
          {t('No se encontraron preguntas.', 'No questions found.')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Pregunta', 'Question')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Tema', 'Topic')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Estado', 'Status')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Acciones', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900">
              {questions.map((q) => (
                <tr
                  key={q._id}
                  className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-3 text-sm font-mono text-ink dark:text-white">
                    {q.exam_id}-{q.question_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink dark:text-white max-w-md truncate">
                    {q.question?.es || q.question?.en || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-light dark:text-slate-400">
                    {q.topic_tag?.es || q.topic_tag?.en || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        q.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-ink-light dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {q.isActive
                        ? t('✅ Activa', '✅ Active')
                        : t('🔒 Inactiva', '🔒 Inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm flex gap-2">
                    <button
                      onClick={() => setEditingQ(q)}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-xs font-bold flex items-center gap-1"
                    >
                      <EditOutlined />
                      {t('Editar', 'Edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(q._id)}
                      className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-xs font-bold flex items-center gap-1"
                    >
                      <DeleteOutlined />
                      {t('Desactivar', 'Deactivate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('Anterior', 'Previous')}
          </button>
          <span className="px-4 py-2 text-ink dark:text-white">
            {t('Página', 'Page')} {page} {t('de', 'of')} {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('Siguiente', 'Next')}
          </button>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────── */}
      {editingQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-ink dark:text-white">
                {t('Editar Pregunta', 'Edit Question')}
              </h2>
              <button
                onClick={() => setEditingQ(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <CloseOutlined />
              </button>
            </div>

            <div className="space-y-4">
              <Field label={t('Pregunta (ES)', 'Question (ES)')}>
                <textarea
                  value={editingQ.question?.es || ''}
                  onChange={(e) =>
                    setEditingQ({
                      ...editingQ,
                      question: { ...editingQ.question, es: e.target.value },
                    })
                  }
                  className="w-full h-24 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-ink dark:text-white focus:ring-2 focus:ring-primary"
                />
              </Field>

              <Field label={t('Pregunta (EN)', 'Question (EN)')}>
                <textarea
                  value={editingQ.question?.en || ''}
                  onChange={(e) =>
                    setEditingQ({
                      ...editingQ,
                      question: { ...editingQ.question, en: e.target.value },
                    })
                  }
                  className="w-full h-24 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-ink dark:text-white focus:ring-2 focus:ring-primary"
                />
              </Field>

              <Field label={t('Estado', 'Status')}>
                <select
                  value={editingQ.isActive ? 'true' : 'false'}
                  onChange={(e) =>
                    setEditingQ({ ...editingQ, isActive: e.target.value === 'true' })
                  }
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-ink dark:text-white focus:ring-2 focus:ring-primary"
                >
                  <option value="true">{t('Activa', 'Active')}</option>
                  <option value="false">{t('Inactiva', 'Inactive')}</option>
                </select>
              </Field>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingEdit ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      {t('Guardando...', 'Saving...')}
                    </>
                  ) : (
                    <>
                      <SaveOutlined />
                      {t('Guardar Cambios', 'Save Changes')}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setEditingQ(null)}
                  disabled={savingEdit}
                  className="px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-ink dark:text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {t('Cancelar', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------
export default function AdminQuestionsPage() {
  return (
    <AppShell adminOnly>
      <AdminQuestionsContent />
    </AppShell>
  )
}
