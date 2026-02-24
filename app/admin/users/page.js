'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'

function AdminUsersContent() {
  const { t } = useAuth()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  const fetchUsers = () => {
    setLoading(true)
    fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => { setUsers(d.users || []); setTotal(d.total || 0); setLoading(false) })
  }

  useEffect(() => { fetchUsers() }, [page, search])

  const togglePremium = async (user) => {
    setUpdating(user._id)
    await fetch(`/api/admin/users/${user._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ premiumOverride: !user.premiumOverride }),
    })
    setUpdating(null)
    fetchUsers()
  }

  const subStatus = (user) => {
    if (user.premiumOverride) return { label: '⭐ Override', cls: 'bg-purple-100 text-purple-700' }
    if (user.subscription?.status === 'active') return { label: '✅ Active', cls: 'bg-green-100 text-green-700' }
    if (user.subscription?.status === 'past_due') return { label: '⚠️ Past Due', cls: 'bg-amber-100 text-amber-700' }
    return { label: '🔒 Inactive', cls: 'bg-slate-100 text-ink-light' }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink">👥 {t('Gestión de Usuarios', 'User Management')}</h1>
        <p className="text-ink-light text-sm">{total} {t('usuarios registrados', 'registered users')}</p>
      </div>

      <input
        type="text"
        placeholder={t('Buscar por email...', 'Search by email...')}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        className="input max-w-md"
      />

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Email', 'Nickname', 'Estado', 'XP', 'Racha', 'Registro', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-ink-light uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const { label, cls } = subStatus(user)
                  return (
                    <tr key={user._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-ink">{user.email}</td>
                      <td className="px-4 py-3 text-sm font-medium text-ink">{user.nickname}</td>
                      <td className="px-4 py-3">
                        <span className={`badge-pill text-xs ${cls}`}>{label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-secondary">{user.gamification?.totalXP || 0}</td>
                      <td className="px-4 py-3 text-sm">
                        {user.gamification?.currentStreak > 0 && `🔥 ${user.gamification.currentStreak}`}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-light whitespace-nowrap">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => togglePremium(user)}
                          disabled={updating === user._id}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                            user.premiumOverride
                              ? 'bg-red-100 text-danger hover:bg-red-200'
                              : 'bg-green-100 text-success hover:bg-green-200'
                          }`}
                        >
                          {updating === user._id ? '...' : user.premiumOverride
                            ? t('Revocar Premium', 'Revoke Premium')
                            : t('Dar Premium', 'Grant Premium')
                          }
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 flex items-center justify-between border-t border-slate-200">
            <span className="text-sm text-ink-light">{Math.min(page * 20, total)} / {total}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">←</button>
              <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">→</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <AppShell requireAdmin>
      <AdminUsersContent />
    </AppShell>
  )
}
