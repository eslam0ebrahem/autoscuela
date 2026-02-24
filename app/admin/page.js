'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function AdminContent() {
  const { t } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    // Quick admin stats
    Promise.all([
      fetch('/api/admin/questions?page=1').then(r => r.json()),
      fetch('/api/admin/users?page=1').then(r => r.json()),
    ]).then(([qData, uData]) => {
      setStats({ questions: qData.total, users: uData.total })
    })
  }, [])

  const adminLinks = [
    {
      href: '/admin/questions',
      icon: '📝',
      title: t('Gestión de Preguntas', 'Question Management'),
      desc: t('Crear, editar, importar y eliminar preguntas del examen', 'Create, edit, import, and delete exam questions'),
      count: stats?.questions,
      color: 'bg-blue-500',
    },
    {
      href: '/admin/users',
      icon: '👥',
      title: t('Gestión de Usuarios', 'User Management'),
      desc: t('Ver usuarios, gestionar suscripciones y acceso premium', 'View users, manage subscriptions and premium access'),
      count: stats?.users,
      color: 'bg-purple-500',
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center text-2xl">
          🛡️
        </div>
        <div>
          <h1 className="text-3xl font-bold text-ink">{t('Panel de Administración', 'Admin Panel')}</h1>
          <p className="text-ink-light">{t('Gestiona el contenido y usuarios de Autoscuela', 'Manage Autoscuela content and users')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {adminLinks.map((link) => (
          <Link key={link.href} href={link.href} className="card-hover block">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 ${link.color} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0`}>
                {link.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink text-lg">{link.title}</h3>
                  {link.count != null && (
                    <span className="badge-pill bg-slate-100 text-ink text-sm">
                      {link.count}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-light mt-1">{link.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick JSON import */}
      <div className="card border-dashed border-2 border-slate-300">
        <h2 className="font-bold text-ink mb-2">⚡ {t('Importación Rápida', 'Quick Import')}</h2>
        <p className="text-sm text-ink-light mb-4">
          {t('Importa preguntas en formato JSON directamente desde tu base de datos gala_exams', 'Import questions in JSON format directly from your gala_exams database')}
        </p>
        <Link href="/admin/questions" className="btn-primary inline-flex">
          {t('Ir a gestión de preguntas →', 'Go to question management →')}
        </Link>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <AppShell requireAdmin>
      <AdminContent />
    </AppShell>
  )
}
