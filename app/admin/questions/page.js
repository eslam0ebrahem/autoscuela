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
// Reusable Sub-components
// ---------------------------------------------------------------------------
const Field = ({ label, children }) => (
  <div className="mb-4">
    <label className="block text-sm font-bold text-ink dark:text-white mb-1">{label}</label>
    {children}
  </div>
)

// ---------------------------------------------------------------------------
// Main Admin Questions Content
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
  const [exporting, setExporting] = useState(false)

  // editingQ can be an existing question object, or a blank object for 'create'
  const [editingQ, setEditingQ] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const debouncedSearch = useDebounce(search, 500)
  const limit = 20
  const totalPages = Math.ceil(total / limit)

  // ── Fetch questions ────────────────────────────────────────────────────
  const fetchQuestions = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
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
        showToast(t('Error al cargar preguntas', 'Error loading questions'), 'error')
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
        return
      }

      if (arr.length > 500) {
        showToast(t('Máximo 500 preguntas por importación', 'Maximum 500 questions per import'), 'error')
        return
      }

      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: arr }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Import failed')

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
    } catch (e) {
      console.error('[admin/questions] Import error:', e)
      setImportResult({ error: e.message })
      showToast(t(`Error al importar: ${e.message}`, `Import error: ${e.message}`), 'error')
    } finally {
      setImporting(false)
    }
  }

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
    reader.onerror = () => showToast(t('Error al leer archivo', 'Error reading file'), 'error')
    reader.readAsText(file)
    // Clear input so the same file can be selected again if needed
    e.target.value = ''
  }

  // ── Export questions ───────────────────────────────────────────────────
  const exportQuestions = async () => {
    setExporting(true)
    try {
      // Fetch ALL questions for export, bypassing pagination limits
      const params = new URLSearchParams({ limit: '0' }) // Assuming '0' or large number fetches all
      const res = await fetch(`/api/admin/questions?${params}`)
      const data = await res.json()
      
      const json = JSON.stringify(data.questions || [], null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vialia-questions-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showToast(t('Preguntas exportadas', 'Questions exported'), 'success')
    } catch (err) {
      console.error('[admin/questions] Export error:', err)
      showToast(t('Error al exportar', 'Error exporting'), 'error')
    } finally {
      setExporting(false)
    }
  }

  // ── Delete/Deactivate question ─────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm(t('¿Desactivar esta pregunta?', 'Deactivate this question?'))) return

    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      
      showToast(t('Pregunta desactivada', 'Question deactivated'), 'success')
      fetchQuestions()
    } catch (err) {
      console.error('[admin/questions] Delete error:', err)
      showToast(t('Error al desactivar', 'Error deactivating'), 'error')
    }
  }

  // ── Save edit / Create ─────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    setSavingEdit(true)
    const isNew = !editingQ._id

    try {
      const url = isNew ? '/api/admin/questions' : `/api/admin/questions/${editingQ._id}`
      const method = isNew ? 'POST' : 'PUT'
      
      // If creating new, wrap in an array if your POST endpoint expects { questions: [...] }
      const payload = isNew ? { questions: [editingQ] } : editingQ

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Save failed')

      showToast(t(isNew ? 'Pregunta creada' : 'Pregunta actualizada', isNew ? 'Question created' : 'Question updated'), 'success')
      setEditingQ(null)
      fetchQuestions()
    } catch (err) {
      console.error('[admin/questions] Save error:', err)
      showToast(t('Error al guardar', 'Error saving'), 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const openCreateModal = () => {
    setEditingQ({
      exam_id: 'A',
      question_number: total + 1,
      question: { es: '', en: '' },
      topic_tag: { es: '', en: '' },
      isActive: true
    })
  }

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-ink dark:text-white mb-2 flex items-center gap-2">
            <FileTextOutlined />
            {t('Gestión de Preguntas', 'Question Management')}
          </h1>
          <p className="text-ink-light dark:text-slate-400">
            {total} {t('preguntas en total', 'total questions')}
          </p>
        </div>
        
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
        >
          <PlusOutlined />
          {t('Nueva Pregunta', 'New Question')}
        </button>
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
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-ink dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>

        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none cursor-pointer"
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
          disabled={total === 0 || exporting}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {exporting ? <ReloadOutlined className="animate-spin" /> : <DownloadOutlined />}
          {t('Exportar', 'Export')}
        </button>
      </div>

      {/* ── Import Section ────────────────────────────────────────────── */}
      {showImport && (
        <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-ink dark:text-white">
              {t('Importar Preguntas JSON', 'Import JSON Questions')}
            </h2>
            <button
              onClick={() => setShowImport(false)}
              className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors text-ink dark:text-white"
              aria-label="Close"
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
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 text-ink dark:text-white"
            >
              <UploadOutlined />
              {t('Subir archivo JSON', 'Upload JSON file')}
            </button>
          </div>

          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"exam_id": "B", "question_number": 1, ...}]'
            className="w-full h-48 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-ink dark:text-white font-mono text-sm focus:ring-2 focus:ring-primary outline-none resize-y"
          />

          <button
            onClick={handleImport}
            disabled={importing || !importJson.trim()}
            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <ReloadOutlined className="animate-spin" />
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
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-ink-light dark:text-slate-400 mb-2">{t('No se encontraron preguntas.', 'No questions found.')}</p>
          {search && (
            <button onClick={() => setSearch('')} className="text-primary hover:underline">
              {t('Limpiar búsqueda', 'Clear search')}
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-sm font-bold text-ink dark:text-white">ID</th>
                <th className="px-4 py-3 text-sm font-bold text-ink dark:text-white">{t('Pregunta', 'Question')}</th>
                <th className="px-4 py-3 text-sm font-bold text-ink dark:text-white">{t('Tema', 'Topic')}</th>
                <th className="px-4 py-3 text-sm font-bold text-ink dark:text-white">{t('Estado', 'Status')}</th>
                <th className="px-4 py-3 text-sm font-bold text-ink dark:text-white">{t('Acciones', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700/50">
              {questions.map((q) => (
                <tr
                  key={q._id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono text-ink dark:text-white">
                    {q.exam_id}-{q.question_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink dark:text-white max-w-md truncate" title={q.question?.es || q.question?.en}>
                    {q.question?.es || q.question?.en || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink-light dark:text-slate-400">
                    {q.topic_tag?.es || q.topic_tag?.en || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        q.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {q.isActive ? t('Activa', 'Active') : t('Inactiva', 'Inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm flex gap-2">
                    <button
                      title={t('Editar', 'Edit')}
                      onClick={() => setEditingQ(q)}
                      className="p-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      <EditOutlined />
                    </button>
                    <button
                      title={t('Desactivar', 'Deactivate')}
                      onClick={() => handleDelete(q._id)}
                      className="p-1.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                    >
                      <DeleteOutlined />
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
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-ink dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {t('Anterior', 'Previous')}
          </button>
          <span className="text-sm text-ink-light dark:text-slate-400">
            {t('Página', 'Page')} <strong className="text-ink dark:text-white">{page}</strong> {t('de', 'of')} <strong className="text-ink dark:text-white">{totalPages}</strong>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-ink dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {t('Siguiente', 'Next')}
          </button>
        </div>
      )}

      {/* ── Edit / Create Modal ───────────────────────────────────────── */}
      {editingQ && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-ink dark:text-white">
                {editingQ._id ? t('Editar Pregunta', 'Edit Question') : t('Nueva Pregunta', 'New Question')}
              </h2>
              <button
                onClick={() => setEditingQ(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <CloseOutlined />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <Field label={t('Pregunta (ES)', 'Question (ES)')}>
                <textarea
                  value={editingQ.question?.es || ''}
                  onChange={(e) =>
                    setEditingQ({
                      ...editingQ,
                      question: { ...editingQ.question, es: e.target.value },
                    })
                  }
                  className="w-full h-24 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none resize-y"
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
                  className="w-full h-24 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none resize-y"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label={t('ID de Examen', 'Exam ID')}>
                  <input
                    type="text"
                    value={editingQ.exam_id || ''}
                    onChange={(e) => setEditingQ({ ...editingQ, exam_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none"
                  />
                </Field>
                <Field label={t('Número', 'Number')}>
                  <input
                    type="number"
                    value={editingQ.question_number || ''}
                    onChange={(e) => setEditingQ({ ...editingQ, question_number: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none"
                  />
                </Field>
              </div>

              <Field label={t('Estado', 'Status')}>
                <select
                  value={editingQ.isActive ? 'true' : 'false'}
                  onChange={(e) =>
                    setEditingQ({ ...editingQ, isActive: e.target.value === 'true' })
                  }
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-ink dark:text-white focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                >
                  <option value="true">{t('Activa', 'Active')}</option>
                  <option value="false">{t('Inactiva', 'Inactive')}</option>
                </select>
              </Field>
            </div>

            <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-800/90 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 z-10 backdrop-blur-md">
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingEdit ? (
                  <>
                    <ReloadOutlined className="animate-spin" />
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
                className="px-6 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-ink dark:text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {t('Cancelar', 'Cancel')}
              </button>
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