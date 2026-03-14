'use client'
import { useState, useEffect, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import {
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  CrownOutlined,
  DownloadOutlined,
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
// Admin Users Content
// ---------------------------------------------------------------------------
function AdminUsersContent() {
  const { t } = useAuth()
  const { showToast } = useToast()

  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  const debouncedSearch = useDebounce(search, 500)

  // ── Fetch users ────────────────────────────────────────────────────────
  const fetchUsers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: page.toString(),
      search: debouncedSearch,
      ...(roleFilter && { role: roleFilter }),
    })

    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || [])
        setTotal(d.total || 0)
      })
      .catch((err) => {
        console.error('[admin/users] Fetch error:', err)
        showToast(
          t('Error al cargar usuarios', 'Error loading users'),
          'error'
        )
      })
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, roleFilter, t, showToast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // ── Toggle premium ─────────────────────────────────────────────────────
  const togglePremium = async (user) => {
    setUpdating(user._id)
    try {
      const res = await fetch(`/api/admin/users/${user._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premiumOverride: !user.premiumOverride }),
      })

      if (res.ok) {
        showToast(
          t('Estado premium actualizado', 'Premium status updated'),
          'success'
        )
        fetchUsers()
      } else {
        throw new Error('Update failed')
      }
    } catch (err) {
      console.error('[admin/users] Toggle premium error:', err)
      showToast(
        t('Error al actualizar premium', 'Error updating premium'),
        'error'
      )
    } finally {
      setUpdating(null)
    }
  }

  // ── Export users ───────────────────────────────────────────────────────
  const exportUsers = () => {
    const csv = [
      ['Email', 'Nickname', 'Role', 'Premium', 'Created At'].join(','),
      ...users.map((u) =>
        [
          u.email,
          u.nickname,
          u.role,
          u.isPremium || u.premiumOverride ? 'Yes' : 'No',
          new Date(u.createdAt).toLocaleDateString(),
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vialia-users-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    showToast(t('Usuarios exportados', 'Users exported'), 'success')
  }

  // ── Subscription status ────────────────────────────────────────────────
  const subStatus = (user) => {
    if (user.premiumOverride) {
      return { label: '⭐ Override', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' }
    }
    if (user.subscription?.status === 'active') {
      return { label: '✅ Active', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
    }
    if (user.subscription?.status === 'past_due') {
      return { label: '⚠️ Past Due', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
    }
    return { label: '🔒 Inactive', cls: 'bg-slate-100 text-ink-light dark:bg-slate-800 dark:text-slate-400' }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-black text-ink dark:text-white mb-2 flex items-center gap-2">
          <UserOutlined />
          {t('Gestión de Usuarios', 'User Management')}
        </h1>
        <p className="text-ink-light dark:text-slate-400">
          {total} {t('usuarios registrados', 'registered users')}
        </p>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light dark:text-slate-400" />
          <input
            type="text"
            placeholder={t('Buscar por email o nickname...', 'Search by email or nickname...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-ink dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-ink dark:text-white focus:ring-2 focus:ring-primary"
        >
          <option value="">{t('Todos los roles', 'All roles')}</option>
          <option value="user">{t('Usuarios', 'Users')}</option>
          <option value="admin">{t('Administradores', 'Admins')}</option>
        </select>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <ReloadOutlined className={loading ? 'animate-spin' : ''} />
          {t('Recargar', 'Reload')}
        </button>

        <button
          onClick={exportUsers}
          disabled={users.length === 0}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <DownloadOutlined />
          {t('Exportar CSV', 'Export CSV')}
        </button>
      </div>

      {/* ── Users Table ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-ink-light dark:text-slate-400">
          {t('No se encontraron usuarios.', 'No users found.')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Email', 'Email')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Nickname', 'Nickname')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Rol', 'Role')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Estado', 'Status')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Fecha Registro', 'Created At')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-ink dark:text-white">
                  {t('Acciones', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900">
              {users.map((user) => {
                const status = subStatus(user)
                return (
                  <tr
                    key={user._id}
                    className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 text-sm text-ink dark:text-white">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink dark:text-white">
                      {user.nickname}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          user.role === 'admin'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                            : 'bg-slate-100 text-ink-light dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-light dark:text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => togglePremium(user)}
                        disabled={updating === user._id}
                        className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 text-xs font-bold flex items-center gap-1"
                      >
                        <CrownOutlined />
                        {user.premiumOverride
                          ? t('Quitar Premium', 'Remove Premium')
                          : t('Dar Premium', 'Grant Premium')}
                      </button>
                    </td>
                  </tr>
                )
              })}
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Export
// ---------------------------------------------------------------------------
export default function AdminUsersPage() {
  return (
    <AppShell adminOnly>
      <AdminUsersContent />
    </AppShell>
  )
}
