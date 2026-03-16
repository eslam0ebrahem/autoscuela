'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import {
  FileTextOutlined,
  UserOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'

// ---------------------------------------------------------------------------
// Admin Dashboard Content
// ---------------------------------------------------------------------------
function AdminContent() {
  const { t } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Fetch admin stats ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const [qData, uData] = await Promise.all([
          fetch('/api/admin/questions?page=1&limit=1').then((r) => r.json()),
          fetch('/api/admin/users?page=1&limit=1').then((r) => r.json()),
        ])

        setStats({
          questions: qData.total || 0,
          users: uData.total || 0,
          activeQuestions: qData.questions?.filter((q) => q.isActive).length || 0,
        })
      } catch (err) {
        console.error('[admin] Stats fetch error:', err)
        setError(t('Error al cargar estadísticas', 'Error loading statistics'))
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [t])

  // ── Admin links configuration ──────────────────────────────────────────
  const adminLinks = [
    {
      href: '/admin/questions',
      icon: <FileTextOutlined className="text-2xl" />,
      title: t('Gestión de Preguntas', 'Question Management'),
      desc: t(
        'Crear, editar, importar y eliminar preguntas del examen',
        'Create, edit, import, and delete exam questions'
      ),
      count: stats?.questions,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      href: '/admin/users',
      icon: <UserOutlined className="text-2xl" />,
      title: t('Gestión de Usuarios', 'User Management'),
      desc: t(
        'Ver usuarios, gestionar suscripciones y acceso premium',
        'View users, manage subscriptions and premium access'
      ),
      count: stats?.users,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-ink dark:text-white flex items-center gap-2">
          <ThunderboltOutlined className="text-primary" />
          {t('Panel de Administración', 'Admin Panel')}
        </h1>
        <p className="text-ink-light dark:text-slate-400">
          {t('Gestiona el contenido y usuarios de Vialia', 'Manage Vialia content and users')}
        </p>
      </div>

      {/* ── Quick Stats ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="text-sm text-ink-light dark:text-slate-400 mb-1">
              {t('Total Preguntas', 'Total Questions')}
            </div>
            <div className="text-3xl font-black text-ink dark:text-white">
              {stats?.questions || 0}
            </div>
          </div>
          <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="text-sm text-ink-light dark:text-slate-400 mb-1">
              {t('Total Usuarios', 'Total Users')}
            </div>
            <div className="text-3xl font-black text-ink dark:text-white">{stats?.users || 0}</div>
          </div>
          <div className="p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="text-sm text-ink-light dark:text-slate-400 mb-1">
              {t('Tasa de Activación', 'Activation Rate')}
            </div>
            <div className="text-3xl font-black text-green-600 dark:text-green-400">
              {stats?.questions ? Math.round((stats.activeQuestions / stats.questions) * 100) : 0}%
            </div>
          </div>
        </div>
      )}

      {/* ── Management Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`group p-6 ${link.bgColor} border ${link.borderColor} rounded-2xl hover:shadow-lg transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}
              >
                {link.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-ink dark:text-white mb-1">{link.title}</h3>
                <p className="text-sm text-ink-light dark:text-slate-400 mb-3">{link.desc}</p>
                {link.count !== undefined && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-ink dark:text-white">
                    <BarChartOutlined />
                    {link.count} {t('items', 'items')}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Quick Import Info ─────────────────────────────────────────── */}
      <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl">
        <div className="flex items-start gap-3">
          <CheckCircleOutlined className="text-2xl text-indigo-600 dark:text-indigo-400 mt-1" />
          <div>
            <h3 className="text-lg font-black text-ink dark:text-white mb-2">
              {t('Importación Rápida', 'Quick Import')}
            </h3>
            <p className="text-sm text-ink-light dark:text-slate-400 mb-3">
              {t(
                'Importa preguntas en formato JSON directamente desde tu base de datos gala_exams',
                'Import questions in JSON format directly from your gala_exams database'
              )}
            </p>
            <Link
              href="/admin/questions"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
            >
              {t('Ir a gestión de preguntas →', 'Go to question management →')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------
export default function AdminDashboardPage() {
  return (
    <AppShell adminOnly>
      <AdminContent />
    </AppShell>
  )
}
