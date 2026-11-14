'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import Table from '@/components/ui/Table'
import { useToast } from '@/components/ui/Toast'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import enMessages from '@/messages/en.json'
import frMessages from '@/messages/fr.json'
import swMessages from '@/messages/sw.json'

type UserRole = 'TEACHER' | 'PARENT' | 'FINANCE' | 'FINANCE_MANAGER' | 'DEPUTY_ADMIN'

type UserItem = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  createdAt: string
}

type RoleFilter = '' | UserRole

const ALL_ROLE_VALUES: UserRole[] = [
  'DEPUTY_ADMIN',
  'TEACHER',
  'PARENT',
  'FINANCE',
  'FINANCE_MANAGER',
]

const ROLE_VALUES: UserRole[] = [
  'TEACHER',
  'PARENT',
  'FINANCE',
  'FINANCE_MANAGER',
]

const DEFAULT_USER_PASSWORD = 'default12345'

const ROLE_PILL_CLASS: Record<UserRole, string> = {
  TEACHER: 'ui-role-teacher',
  PARENT: 'ui-role-parent',
  FINANCE: 'ui-role-finance',
  FINANCE_MANAGER: 'ui-role-finance-manager',
  DEPUTY_ADMIN: 'ui-role-deputy',
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const pageSize = 20

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'TEACHER' as UserRole,
  })

  const preferredLanguage = session?.user?.preferredLanguage || 'fr'
  const languageMessages = useMemo(
    () => (preferredLanguage === 'fr' ? frMessages : preferredLanguage === 'sw' ? swMessages : enMessages),
    [preferredLanguage]
  )
  const adminUsers = useMemo(
    () => ((languageMessages as Record<string, unknown>).adminUsers || {}) as Record<string, string>,
    [languageMessages]
  )
  const roles = useMemo(
    () => ((languageMessages as Record<string, unknown>).roles || {}) as Record<string, string>,
    [languageMessages]
  )

  const t = useCallback((key: string, fallback: string) => adminUsers[key] || fallback, [adminUsers])

  const roleLabel = useCallback(
    (role: UserRole) => {
      if (role === 'DEPUTY_ADMIN') return roles.deputy_admin || 'Directeur Adjoint'
      if (role === 'FINANCE') return roles.finance || 'Finance'
      if (role === 'FINANCE_MANAGER') return roles.finance_manager || 'Responsable Financier'
      if (role === 'PARENT') return roles.parent || 'Parent'
      return roles.teacher || 'Enseignant'
    },
    [roles]
  )

  const creatableRoles = session?.user?.role === 'SCHOOL_ADMIN' ? ALL_ROLE_VALUES : ROLE_VALUES

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && session.user.role !== 'SCHOOL_ADMIN' && session.user.role !== 'DEPUTY_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/users')
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('failedLoadUsers', 'Échec du chargement des utilisateurs'), 'error')
        return
      }
      const filtered = (Array.isArray(data.users) ? data.users : []).filter(
        (u: { role: string }) =>
          u.role !== 'SCHOOL_ADMIN' && u.role !== 'SUPER_ADMIN' && u.role !== 'STUDENT'
      ) as UserItem[]
      setUsers(filtered)
    } catch {
      showToast(t('failedLoadUsers', 'Échec du chargement des utilisateurs'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, t])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN' || session?.user?.role === 'DEPUTY_ADMIN') {
      void fetchUsers()
    }
  }, [session?.user?.role, fetchUsers])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false
      if (!q) return true
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase()
      return fullName.includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [users, searchQuery, roleFilter])

  const currentPageRows = useMemo(() => {
    const start = (tablePage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, tablePage])

  const filterOptions = useMemo(
    () => [
      { value: '', label: t('allRoles', 'Tous les rôles') },
      ...creatableRoles.map((value) => ({ value, label: roleLabel(value) })),
    ],
    [creatableRoles, roleLabel, t]
  )

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', email: '', role: 'TEACHER' })
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSaving(true)
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // Password is fixed server-side to default12345 + mustResetPassword
          password: '',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          Array.isArray(data.error) && data.error[0]?.message
            ? String(data.error[0].message)
            : typeof data.error === 'string'
              ? data.error
              : t('failedSaveUser', "Échec de l'enregistrement de l'utilisateur")
        showToast(msg, 'error')
        return
      }
      const tempPassword =
        typeof data.temporaryPassword === 'string' ? data.temporaryPassword : DEFAULT_USER_PASSWORD
      showToast(
        t(
          'userCreatedWithDefaultPassword',
          'Utilisateur créé. Mot de passe temporaire : {password}. À changer à la première connexion.'
        ).replace('{password}', tempPassword),
        'success'
      )
      setShowModal(false)
      resetForm()
      await fetchUsers()
    } catch {
      showToast(t('failedSaveUser', "Échec de l'enregistrement de l'utilisateur"), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(
    async (userId: string) => {
      if (!confirm(t('confirmDeleteUser', 'Êtes-vous sûr de vouloir supprimer cet utilisateur ?'))) return
      try {
        const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          showToast(data.error || t('failedDeleteUser', "Échec de la suppression de l'utilisateur"), 'error')
          return
        }
        showToast(t('userDeleted', 'Utilisateur supprimé avec succès'), 'success')
        await fetchUsers()
      } catch {
        showToast(t('failedDeleteUser', "Échec de la suppression de l'utilisateur"), 'error')
      }
    },
    [fetchUsers, showToast, t]
  )

  const handleResetPassword = useCallback(
    async (user: UserItem) => {
      const newPassword = prompt(
        t('resetPasswordPrompt', 'Entrez un mot de passe temporaire (min 6 caractères) :')
      )
      if (!newPassword) return
      if (newPassword.length < 6) {
        showToast(t('passwordMin6', 'Le mot de passe doit contenir au moins 6 caractères'), 'error')
        return
      }
      try {
        const res = await fetch(`/api/users/${user.id}/reset-password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showToast(
            data.error || t('failedResetPassword', 'Échec de la réinitialisation du mot de passe'),
            'error'
          )
          return
        }
        showToast(
          t(
            'passwordReset',
            "Mot de passe réinitialisé. L'utilisateur doit le modifier à la première connexion."
          ),
          'success'
        )
      } catch {
        showToast(t('failedResetPassword', 'Échec de la réinitialisation du mot de passe'), 'error')
      }
    },
    [showToast, t]
  )

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: t('columnName', 'Nom'),
        sortable: true,
        renderCell: (u: UserItem) => (
          <div className="flex flex-col">
            <span className="font-medium ui-text-primary">
              {`${u.firstName || ''} ${u.lastName || ''}`.trim() || '—'}
            </span>
            <span className="text-xs ui-text-secondary">{u.email}</span>
          </div>
        ),
      },
      {
        key: 'role',
        label: t('columnRole', 'Rôle'),
        sortable: true,
        renderCell: (u: UserItem) => (
          <span className={`ui-status ${ROLE_PILL_CLASS[u.role]}`}>{roleLabel(u.role)}</span>
        ),
      },
      {
        key: 'createdAt',
        label: t('columnJoined', 'Inscrit le'),
        sortable: true,
        renderCell: (u: UserItem) =>
          new Date(u.createdAt).toLocaleDateString(preferredLanguage === 'fr' ? 'fr-FR' : undefined),
      },
    ],
    [preferredLanguage, roleLabel, t]
  )

  const getRowActions = useCallback(
    (u: UserItem) => [
      {
        label: t('resetPassword', 'Réinitialiser le mot de passe'),
        onClick: () => {
          void handleResetPassword(u)
        },
      },
      {
        label: t('delete', 'Supprimer'),
        danger: true,
        onClick: () => {
          void handleDelete(u.id)
        },
      },
    ],
    [handleDelete, handleResetPassword, t]
  )

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  if (status === 'loading' || !session?.user) {
    return <div>{t('loading', 'Chargement...')}</div>
  }

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: session?.user?.role === 'DEPUTY_ADMIN' ? 'Deputy Admin' : 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[1.25rem] font-semibold ui-text-primary">
              {t('pageTitle', 'Gestion des utilisateurs')}
            </h1>
            <p className="mt-1 text-sm ui-text-secondary">
              {t(
                'pageSubtitle',
                'Ajoutez et gérez les enseignants, les parents et les utilisateurs finance de votre école.'
              )}
            </p>
          </div>
          <Button onClick={openCreateModal} className="inline-flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" />
            {t('addUser', 'Ajouter un utilisateur')}
          </Button>
        </div>

        <Table
          title={t('users', 'Utilisateurs')}
          columns={columns}
          data={currentPageRows}
          loading={loading}
          totalCount={filteredUsers.length}
          page={tablePage}
          pageSize={pageSize}
          onPageChange={setTablePage}
          onSearch={(value) => {
            setSearchQuery(value)
            setTablePage(1)
          }}
          filterLabel={t('filterByRole', 'Rôle')}
          filterOptions={filterOptions}
          activeFilter={roleFilter}
          onFilterChange={(value) => {
            setRoleFilter(value as RoleFilter)
            setTablePage(1)
          }}
          getRowActions={getRowActions}
          rowKey="id"
          emptyMessage={
            searchQuery.trim() || roleFilter
              ? t('noSearchResults', 'Aucun utilisateur ne correspond à votre recherche.')
              : t('noUsersFound', 'Aucun utilisateur trouvé.')
          }
          ariaLabel={t('users', 'Utilisateurs')}
        />
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
          <div className="w-full max-w-lg rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[1.25rem] font-semibold ui-text-primary">
              {t('addUser', 'Ajouter un utilisateur')}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  label={t('firstName', 'Prénom')}
                  value={formData.firstName}
                  onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                  required
                />
                <Input
                  label={t('lastName', 'Nom')}
                  value={formData.lastName}
                  onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                  required
                />
              </div>
              <Input
                label={t('email', 'E-mail')}
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                required
              />
              <Input
                label={t('password', 'Mot de passe')}
                type="text"
                value={DEFAULT_USER_PASSWORD}
                readOnly
                disabled
                autoComplete="off"
              />
              <p className="text-xs ui-text-secondary">
                {t(
                  'mustResetNote',
                  'Mot de passe par défaut — l’utilisateur doit le changer à la première connexion.'
                )}
              </p>
              <Select
                label={t('columnRole', 'Rôle')}
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value as UserRole }))}
              >
                {creatableRoles.map((value) => (
                  <option key={value} value={value}>
                    {roleLabel(value)}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  isLoading={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="h-4 w-4" />
                  {t('createUser', 'Créer un utilisateur')}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="flex-1 ui-button ui-button-secondary"
                >
                  {t('cancel', 'Annuler')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}
