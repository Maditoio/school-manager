'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Download, Save } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DetailCard, DetailTabs, KpiStrip } from '@/components/admin/detail'
import { Button } from '@/components/ui/Button'
import Table from '@/components/ui/Table'
import { Input, TextArea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { useCurrency } from '@/lib/currency-context'
import { ADMIN_NAV_ITEMS, DEPUTY_ADMIN_NAV_ITEMS } from '@/lib/admin-nav'
import { useAdminUi } from '@/lib/use-admin-ui'

type ExpenseCategory =
  | 'MAINTENANCE' | 'SALARIES' | 'BURSARIES' | 'SPECIAL_DISCOUNTS'
  | 'CLEANING' | 'SOFTWARE_LICENSES' | 'TRAINING_PROGRAMS' | 'SPORTS_TRIPS'
  | 'REFRESHMENTS' | 'KITCHEN' | 'UTILITIES' | 'TRANSPORT' | 'EQUIPMENT' | 'OTHER'

type ExpenseStatus = 'RECORDED' | 'APPROVED' | 'VOID'

type ExpenseTab = 'all' | 'pending' | 'approved' | 'void' | 'audit'

type ExpenseItem = {
  id: string
  title: string
  description: string | null
  category: ExpenseCategory
  amount: number
  expenseDate: string
  vendorName: string | null
  referenceNumber: string | null
  invoiceUrl: string | null
  invoiceFileName: string | null
  invoiceMimeType: string | null
  beneficiaryName: string | null
  status: ExpenseStatus
  studentName: string | null
  createdById: string
  createdByName: string
  auditCount: number
  updatedAt: string
}

type ExpenseAuditLog = {
  id: string
  expenseId: string
  expenseTitle: string
  action: string
  details: Record<string, unknown> | null
  createdAt: string
  actorName: string
}

type Summary = {
  totalAmount: number
  monthAmount: number
  peopleAmount: number
  recordedCount: number
  approvedCount: number
  voidCount: number
}

const CATEGORY_KEYS: Record<ExpenseCategory, string> = {
  MAINTENANCE: 'categoryMaintenance',
  SALARIES: 'categorySalaries',
  BURSARIES: 'categoryBursaries',
  SPECIAL_DISCOUNTS: 'categorySpecialDiscounts',
  CLEANING: 'categoryCleaning',
  SOFTWARE_LICENSES: 'categorySoftwareLicenses',
  TRAINING_PROGRAMS: 'categoryTrainingPrograms',
  SPORTS_TRIPS: 'categorySportsTrips',
  REFRESHMENTS: 'categoryRefreshments',
  KITCHEN: 'categoryKitchen',
  UTILITIES: 'categoryUtilities',
  TRANSPORT: 'categoryTransport',
  EQUIPMENT: 'categoryEquipment',
  OTHER: 'categoryOther',
}

const CATEGORY_FALLBACKS: Record<ExpenseCategory, string> = {
  MAINTENANCE: 'Maintenance',
  SALARIES: 'Salaires',
  BURSARIES: 'Bourses',
  SPECIAL_DISCOUNTS: 'Remises spéciales',
  CLEANING: 'Nettoyage',
  SOFTWARE_LICENSES: 'Licences logicielles',
  TRAINING_PROGRAMS: 'Programmes de formation',
  SPORTS_TRIPS: 'Sorties sportives',
  REFRESHMENTS: 'Rafraîchissements',
  KITCHEN: 'Cuisine',
  UTILITIES: 'Services publics',
  TRANSPORT: 'Transport',
  EQUIPMENT: 'Équipement',
  OTHER: 'Autre',
}

const TAB_STATUS: Record<Exclude<ExpenseTab, 'audit'>, ExpenseStatus | ''> = {
  all: '',
  pending: 'RECORDED',
  approved: 'APPROVED',
  void: 'VOID',
}

export default function AdminExpensesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const { locale, languageMessages, tCommon } = useAdminUi()
  const { formatCurrency } = useCurrency()

  const expensesMsg = useMemo(
    () => ((languageMessages as Record<string, unknown>).expenses || {}) as Record<string, string>,
    [languageMessages]
  )
  const t = useCallback((key: string, fallback: string) => expensesMsg[key] || fallback, [expensesMsg])

  const dateLocale = locale === 'fr' ? 'fr-FR' : locale === 'sw' ? 'sw-TZ' : 'en-GB'

  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [auditLogs, setAuditLogs] = useState<ExpenseAuditLog[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalAmount: 0, monthAmount: 0, peopleAmount: 0,
    recordedCount: 0, approvedCount: 0, voidCount: 0,
  })
  const [selectedExpenseId, setSelectedExpenseId] = useState('')
  const [activeTab, setActiveTab] = useState<ExpenseTab>('pending')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const pageSize = 15
  const auditPageSize = 20
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [incomeSummary, setIncomeSummary] = useState<{ totalIncome: number; totalExpenses: number; net: number } | null>(null)

  const [approvingSaving, setApprovingSaving] = useState(false)
  const [threshold, setThreshold] = useState(0)
  const [thresholdInput, setThresholdInput] = useState('0')
  const [thresholdSaving, setThresholdSaving] = useState(false)
  const [invoicePreview, setInvoicePreview] = useState<{ url: string; fileName: string; mimeType: string | null } | null>(null)

  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidTargetId, setVoidTargetId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidSaving, setVoidSaving] = useState(false)

  const statusFilter = activeTab === 'audit' ? '' : TAB_STATUS[activeTab]

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && session.user.role !== 'SCHOOL_ADMIN' && session.user.role !== 'DEPUTY_ADMIN') {
      redirect('/admin/dashboard')
    }
  }, [session, status])

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (categoryFilter) params.set('category', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      params.set('auditPage', String(auditPage))
      params.set('auditPageSize', String(auditPageSize))
      const res = await fetch(`/api/expenses?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('failedLoadExpenses', 'Échec du chargement des dépenses'), 'error')
        return
      }
      setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
      setAuditLogs(Array.isArray(data.recentAuditLogs) ? data.recentAuditLogs : [])
      setAuditTotal(data.auditTotal ?? 0)
      setSummary(data.summary || {
        totalAmount: 0, monthAmount: 0, peopleAmount: 0,
        recordedCount: 0, approvedCount: 0, voidCount: 0,
      })
      const nextThreshold = data.expenseApprovalThreshold ?? 0
      setThreshold(nextThreshold)
      setThresholdInput(String(nextThreshold))
      setSelectedExpenseId((cur) => cur || data.expenses?.[0]?.id || '')
    } catch {
      showToast(t('failedLoadExpenses', 'Échec du chargement des dépenses'), 'error')
    } finally {
      setLoading(false)
    }
  }, [t, categoryFilter, statusFilter, searchQuery, dateFrom, dateTo, auditPage, auditPageSize])

  useEffect(() => {
    if (session?.user?.role === 'SCHOOL_ADMIN' || session?.user?.role === 'DEPUTY_ADMIN') fetchExpenses()
  }, [session?.user?.role, fetchExpenses])

  useEffect(() => {
    if (!session?.user?.role) return
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    fetch(`/api/expenses/summary?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => { if (d.totalIncome !== undefined) setIncomeSummary(d) })
      .catch(() => null)
  }, [session?.user?.role])

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesQ = !q || [e.title, e.vendorName, e.referenceNumber, e.beneficiaryName, e.studentName, e.createdByName]
        .some((v) => String(v || '').toLowerCase().includes(q))
      return matchesQ && (!categoryFilter || e.category === categoryFilter) && (!statusFilter || e.status === statusFilter)
    })
  }, [expenses, searchQuery, categoryFilter, statusFilter])

  const currentPageRows = useMemo(() => {
    const start = (tablePage - 1) * pageSize
    return filteredExpenses.slice(start, start + pageSize)
  }, [filteredExpenses, tablePage])

  const selectedAuditLogs = useMemo(
    () => auditLogs.filter((l) => l.expenseId === selectedExpenseId),
    [auditLogs, selectedExpenseId]
  )

  const categoryLabel = useCallback(
    (category: ExpenseCategory) => t(CATEGORY_KEYS[category], CATEGORY_FALLBACKS[category]),
    [t]
  )

  const handleExportCSV = () => {
    const headers = [
      t('columnExpense', 'Dépense'),
      t('labelCategory', 'Catégorie'),
      t('columnAmount', 'Montant'),
      t('columnDate', 'Date'),
      t('columnStatus', 'Statut'),
      t('labelVendor', 'Fournisseur'),
      t('labelReference', 'Référence'),
      t('labelBeneficiary', 'Bénéficiaire'),
      t('columnRecordedBy', 'Enregistré par'),
    ]
    const statusLabels: Record<ExpenseStatus, string> = {
      RECORDED: t('statusRecorded', 'Enregistré'),
      APPROVED: t('statusApproved', 'Approuvé'),
      VOID: t('statusVoid', 'Annulé'),
    }
    const rows = filteredExpenses.map((e) => [
      e.title,
      categoryLabel(e.category),
      e.amount,
      new Date(e.expenseDate).toLocaleDateString(dateLocale),
      statusLabels[e.status],
      e.vendorName || '',
      e.referenceNumber || '',
      e.beneficiaryName || '',
      e.createdByName,
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveThreshold = async () => {
    const value = parseFloat(thresholdInput)
    if (isNaN(value) || value < 0) {
      showToast(t('pleaseEnterValidAmount', 'Veuillez saisir un montant valide'), 'warning')
      return
    }
    try {
      setThresholdSaving(true)
      const res = await fetch('/api/schools/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseApprovalThreshold: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('failedSaveSetting', "Échec de l'enregistrement du paramètre"), 'error')
        return
      }
      setThreshold(data.expenseApprovalThreshold)
      setThresholdInput(String(data.expenseApprovalThreshold))
      showToast(t('approvalLimitSaved', "Limite d'approbation enregistrée"), 'success')
    } catch {
      showToast(t('failedSaveSetting', "Échec de l'enregistrement du paramètre"), 'error')
    } finally {
      setThresholdSaving(false)
    }
  }

  const handleApprove = async (expenseId: string) => {
    try {
      setApprovingSaving(true)
      const res = await fetch(`/api/expenses/${expenseId}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('approveFailed', "Échec de l'approbation de la dépense"), 'error')
        return
      }
      showToast(t('approveSuccess', 'Dépense approuvée'), 'success')
      await fetchExpenses()
    } catch {
      showToast(t('approveFailed', "Échec de l'approbation de la dépense"), 'error')
    } finally {
      setApprovingSaving(false)
    }
  }

  const handleVoidClick = (expenseId: string) => {
    setVoidTargetId(expenseId)
    setVoidReason('')
    setShowVoidModal(true)
  }

  const handleVoidConfirm = async () => {
    if (!voidTargetId) return
    const trimmed = voidReason.trim()
    if (trimmed.length < 3) {
      showToast(t('voidReasonRequired', 'Une raison est requise (minimum 3 caractères)'), 'warning')
      return
    }
    try {
      setVoidSaving(true)
      const res = await fetch(`/api/expenses/${voidTargetId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || t('failedVoidExpense', "Échec de l'annulation de la dépense"), 'error')
        return
      }
      showToast(t('expenseVoided', 'Dépense annulée'), 'success')
      setShowVoidModal(false)
      setVoidTargetId(null)
      await fetchExpenses()
    } catch {
      showToast(t('failedVoidExpense', "Échec de l'annulation de la dépense"), 'error')
    } finally {
      setVoidSaving(false)
    }
  }

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setCategoryFilter('')
    setSearchQuery('')
    setTablePage(1)
  }

  const hasActiveFilters = Boolean(dateFrom || dateTo || categoryFilter || searchQuery.trim())

  const handleTabChange = (tab: ExpenseTab) => {
    setActiveTab(tab)
    setTablePage(1)
  }

  const tabs = useMemo(
    () => [
      { key: 'all' as const, label: t('tabAll', 'Tous') },
      {
        key: 'pending' as const,
        label: `${t('tabPending', 'En attente')}${summary.recordedCount ? ` (${summary.recordedCount})` : ''}`,
      },
      {
        key: 'approved' as const,
        label: `${t('tabApproved', 'Approuvées')}${summary.approvedCount ? ` (${summary.approvedCount})` : ''}`,
      },
      {
        key: 'void' as const,
        label: `${t('tabVoid', 'Annulées')}${summary.voidCount ? ` (${summary.voidCount})` : ''}`,
      },
      { key: 'audit' as const, label: t('tabAudit', 'Audit') },
    ],
    [t, summary.recordedCount, summary.approvedCount, summary.voidCount]
  )

  const columns = useMemo(() => [
    {
      key: 'title',
      label: t('columnExpense', 'Dépense'),
      sortable: true,
      renderCell: (e: ExpenseItem) => (
        <div className="flex flex-col">
          <span className="font-medium ui-text-primary">{e.title}</span>
          <span className="text-xs ui-text-secondary">
            {categoryLabel(e.category)}
            {e.referenceNumber ? ` · ${e.referenceNumber}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'amount',
      label: t('columnAmount', 'Montant'),
      sortable: true,
      renderCell: (e: ExpenseItem) => (
        <span className="font-semibold ui-text-primary">{formatCurrency(e.amount)}</span>
      ),
    },
    {
      key: 'expenseDate',
      label: t('columnDate', 'Date'),
      sortable: true,
      renderCell: (e: ExpenseItem) => (
        <span className="ui-text-secondary">{new Date(e.expenseDate).toLocaleDateString(dateLocale)}</span>
      ),
    },
    {
      key: 'createdByName',
      label: t('columnRecordedBy', 'Enregistré par'),
      sortable: true,
      renderCell: (e: ExpenseItem) => <span className="ui-text-secondary">{e.createdByName}</span>,
    },
    {
      key: 'invoice',
      label: t('columnInvoice', 'Facture'),
      renderCell: (e: ExpenseItem) => (
        e.invoiceUrl ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setInvoicePreview({
                url: e.invoiceUrl as string,
                fileName: e.invoiceFileName || t('columnInvoice', 'Facture'),
                mimeType: e.invoiceMimeType,
              })
            }}
            className="ui-table-link text-sm"
          >
            {e.invoiceFileName || t('viewInvoice', 'Voir la facture')}
          </button>
        ) : <span className="text-xs ui-text-secondary">—</span>
      ),
    },
    {
      key: 'status',
      label: t('columnStatus', 'Statut'),
      sortable: true,
      renderCell: (e: ExpenseItem) => {
        const tones: Record<ExpenseStatus, string> = {
          RECORDED: 'ui-status-pending',
          APPROVED: 'ui-status-success',
          VOID: 'ui-status-neutral',
        }
        const labels: Record<ExpenseStatus, string> = {
          RECORDED: t('statusRecorded', 'Enregistré'),
          APPROVED: t('statusApproved', 'Approuvé'),
          VOID: t('statusVoid', 'Annulé'),
        }
        return (
          <span className={`ui-status ${tones[e.status]}`}>
            {labels[e.status]}
          </span>
        )
      },
    },
  ], [t, categoryLabel, formatCurrency, dateLocale])

  const getRowActions = (e: ExpenseItem) => {
    const actions: Array<{ label: string; danger?: boolean; onClick?: () => void }> = [
      {
        label: `${t('columnAudit', 'Audit')} (${e.auditCount})`,
        onClick: () => {
          setSelectedExpenseId(e.id)
          setActiveTab('audit')
        },
      },
    ]
    if (e.status === 'RECORDED') {
      actions.push({
        label: t('approveExpense', 'Approuver'),
        onClick: () => {
          if (!approvingSaving) void handleApprove(e.id)
        },
      })
    }
    if (e.status !== 'VOID') {
      actions.push({
        label: t('voidReasonTitle', 'Annuler la dépense'),
        danger: true,
        onClick: () => handleVoidClick(e.id),
      })
    }
    return actions
  }

  const categoryFilterOptions = useMemo(
    () => [
      { value: '', label: t('allCategories', 'Toutes les catégories') },
      ...(Object.keys(CATEGORY_KEYS) as ExpenseCategory[]).map((value) => ({
        value,
        label: categoryLabel(value),
      })),
    ],
    [t, categoryLabel]
  )

  const kpiItems = useMemo(() => {
    const items = [
      {
        id: 'total',
        label: t('totalExpenses', 'Total des dépenses'),
        value: formatCurrency(summary.totalAmount),
      },
      {
        id: 'month',
        label: t('thisMonth', 'Ce mois-ci'),
        value: formatCurrency(summary.monthAmount),
        hint: incomeSummary
          ? `${t('feeIncomeThisMonth', 'Revenus des frais (ce mois)')}: ${formatCurrency(incomeSummary.totalIncome)}`
          : undefined,
      },
      {
        id: 'pending',
        label: t('pendingApproval', "En attente d'approbation"),
        value: summary.recordedCount,
      },
      {
        id: 'approved',
        label: t('approvedRecords', 'Dossiers approuvés'),
        value: summary.approvedCount,
        hint: incomeSummary
          ? `${t('netPosition', 'Position nette')}: ${incomeSummary.net >= 0 ? '+' : ''}${formatCurrency(incomeSummary.net)}`
          : undefined,
      },
    ]
    return items
  }, [t, formatCurrency, summary, incomeSummary])

  const navItems = session?.user?.role === 'DEPUTY_ADMIN' ? DEPUTY_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  if (status === 'loading' || !session?.user) {
    return <div>{tCommon('loading', 'Chargement...')}</div>
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold ui-text-primary">
              {t('approvalPageTitle', 'Approbation des dépenses')}
            </h1>
            <p className="mt-1 text-sm ui-text-secondary">
              {t(
                'approvalPageSubtitle',
                "Examinez et approuvez les dépenses soumises par l'équipe financière. Les enregistrements approuvés sont verrouillés."
              )}
            </p>
          </div>
          {activeTab !== 'audit' ? (
            <Button
              type="button"
              variant="secondary"
              className="inline-flex h-8 items-center gap-1.5"
              onClick={handleExportCSV}
              disabled={filteredExpenses.length === 0}
            >
              <Download className="h-4 w-4" />
              {t('exportCsv', 'Exporter CSV')}
            </Button>
          ) : null}
        </div>

        <KpiStrip items={kpiItems} />

        {session?.user?.role === 'SCHOOL_ADMIN' ? (
          <DetailCard>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold ui-text-primary">
                  {t('financeManagerApprovalLimit', "Limite d'approbation du Responsable Financier")}
                </h2>
                <p className="mt-1 text-sm ui-text-secondary">
                  {t(
                    'financeManagerLimitDesc',
                    'Les responsables financiers peuvent approuver les dépenses jusqu’à ce montant. Définir à 0 pour désactiver la délégation.'
                  )}
                </p>
                {threshold > 0 ? (
                  <p className="mt-1 text-xs ui-text-secondary">
                    {t('currentLimit', 'Limite actuelle')}: <span className="font-semibold ui-text-primary">{formatCurrency(threshold)}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs ui-text-secondary">
                    {t('delegationDisabled', 'Délégation désactivée — seuls les administrateurs peuvent approuver les dépenses')}
                  </p>
                )}
              </div>
              <div className="flex items-end gap-2">
                <div className="w-40">
                  <Input
                    label={t('approvalLimitAmount', "Montant limite d'approbation")}
                    type="number"
                    min="0"
                    step="0.01"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    className="h-8 min-h-8 py-0"
                  />
                </div>
                <Button
                  type="button"
                  isLoading={thresholdSaving}
                  onClick={handleSaveThreshold}
                  className="h-8 shrink-0 inline-flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  {t('saveLimit', 'Enregistrer la limite')}
                </Button>
              </div>
            </div>
          </DetailCard>
        ) : null}

        <DetailTabs tabs={tabs} active={activeTab} onChange={handleTabChange} />

        {activeTab !== 'audit' ? (
          <Table
            title={t('expenseRegister', 'Registre des dépenses')}
            columns={columns}
            data={currentPageRows}
            loading={loading}
            totalCount={filteredExpenses.length}
            page={tablePage}
            pageSize={pageSize}
            onPageChange={setTablePage}
            onSearch={(value) => {
              setSearchQuery(value)
              setTablePage(1)
            }}
            filterLabel={t('labelCategory', 'Catégorie')}
            filterOptions={categoryFilterOptions}
            activeFilter={categoryFilter}
            onFilterChange={(value) => {
              setCategoryFilter(value)
              setTablePage(1)
            }}
            headerControls={
              <>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value)
                    setTablePage(1)
                  }}
                  className="ui-input h-8 rounded-lg px-2.5 text-[12px]"
                  style={{ minHeight: '2rem', paddingTop: 0, paddingBottom: 0 }}
                  aria-label={t('fromDate', 'Du')}
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value)
                    setTablePage(1)
                  }}
                  className="ui-input h-8 rounded-lg px-2.5 text-[12px]"
                  style={{ minHeight: '2rem', paddingTop: 0, paddingBottom: 0 }}
                  aria-label={t('toDate', 'Au')}
                />
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ui-table-link text-sm whitespace-nowrap"
                  >
                    {t('clearFilters', 'Effacer')}
                  </button>
                ) : null}
              </>
            }
            getRowActions={getRowActions}
            onRowClick={(row) => setSelectedExpenseId(row.id)}
            emptyMessage={t('noExpensesFound', 'Aucune dépense trouvée.')}
            rowKey="id"
            ariaLabel={t('expenseRegister', 'Registre des dépenses')}
          />
        ) : (
          <div className="space-y-4">
            <DetailCard>
              <h2 className="text-sm font-semibold ui-text-primary">
                {t('auditTrail', "Piste d'audit")}
              </h2>
              {selectedAuditLogs.length === 0 ? (
                <p className="mt-2 text-sm ui-text-secondary">
                  {t('selectExpenseAudit', 'Sélectionnez une dépense pour inspecter sa piste d’audit.')}
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-[10px] border border-(--border-subtle) bg-(--surface-soft) px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium ui-text-primary">{log.expenseTitle}</p>
                          <p className="text-sm ui-text-secondary">
                            {log.action} {t('by', 'par')} {log.actorName}
                            {log.details && typeof log.details === 'object' && 'reason' in log.details
                              ? ` — ${String(log.details.reason)}`
                              : null}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs ui-text-secondary">
                          {new Date(log.createdAt).toLocaleString(dateLocale)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DetailCard>

            <DetailCard>
              <h2 className="text-sm font-semibold ui-text-primary">
                {t('allAuditEvents', "Tous les événements d'audit")}
                {auditTotal > 0 ? ` (${auditTotal})` : ''}
              </h2>
              {auditLogs.length === 0 ? (
                <p className="mt-2 text-sm ui-text-secondary">
                  {t('noAuditEvents', "Aucun événement d'audit pour l’instant.")}
                </p>
              ) : (
                <>
                  <div className="mt-3 ui-table-wrap overflow-x-auto">
                    <table className="ui-table no-table-stripes min-w-full">
                      <thead>
                        <tr>
                          <th>{t('columnExpense', 'Dépense')}</th>
                          <th>{t('columnActions', 'Actions')}</th>
                          <th>{t('columnDate', 'Date')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr
                            key={log.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedExpenseId(log.expenseId)}
                          >
                            <td>
                              <span className="font-medium ui-text-primary">{log.expenseTitle}</span>
                            </td>
                            <td>
                              <span className="ui-text-secondary">
                                {log.action} · {log.actorName}
                              </span>
                            </td>
                            <td>
                              <span className="ui-text-secondary">
                                {new Date(log.createdAt).toLocaleString(dateLocale)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {auditTotal > auditPageSize ? (
                    <div className="mt-3 flex items-center justify-between text-sm ui-text-secondary">
                      <span>
                        {t('showing', 'Affichage')} {(auditPage - 1) * auditPageSize + 1}–
                        {Math.min(auditPage * auditPageSize, auditTotal)} {t('of', 'sur')} {auditTotal}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={auditPage === 1}
                          onClick={() => setAuditPage((p) => p - 1)}
                        >
                          ← {t('prev', 'Préc.')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={auditPage * auditPageSize >= auditTotal}
                          onClick={() => setAuditPage((p) => p + 1)}
                        >
                          {t('next', 'Suiv.')} →
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </DetailCard>
          </div>
        )}
      </div>

      {showVoidModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
          <div className="w-full max-w-md rounded-[10px] border border-(--border-subtle) bg-(--surface) p-5">
            <h2 className="text-[20px] font-semibold ui-text-primary">
              {t('voidReasonTitle', 'Annuler la dépense')}
            </h2>
            <div className="mt-4 space-y-4">
              <p className="text-sm ui-text-secondary">
                {t(
                  'voidConfirm',
                  'Annuler cet enregistrement de dépense ? La piste d’audit sera préservée.'
                )}
              </p>
              <TextArea
                label={t('voidReasonLabel', "Raison de l'annulation")}
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder={t('voidReasonPlaceholder', "Saisissez la raison de l'annulation...")}
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowVoidModal(false)
                    setVoidTargetId(null)
                  }}
                  disabled={voidSaving}
                >
                  {tCommon('cancel', 'Annuler')}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  isLoading={voidSaving}
                  onClick={handleVoidConfirm}
                >
                  {t('confirmVoid', "Confirmer l'annulation")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {invoicePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay) p-4">
          <div className="w-full max-w-3xl rounded-[10px] border border-(--border-subtle) bg-(--surface) p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[20px] font-semibold ui-text-primary">
                  {t('invoicePreview', 'Aperçu de la facture')}
                </h2>
                <p className="truncate text-sm ui-text-secondary">{invoicePreview.fileName}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={invoicePreview.url}
                  download={invoicePreview.fileName}
                  className="ui-button ui-button-secondary h-8 px-3.5 text-[13px] inline-flex items-center"
                >
                  {t('download', 'Télécharger')}
                </a>
                <button
                  type="button"
                  onClick={() => setInvoicePreview(null)}
                  className="ui-button ui-button-secondary h-8 px-3.5 text-[13px]"
                >
                  {t('close', 'Fermer')}
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-[10px] border border-(--border-subtle) bg-(--surface-soft) p-2">
              {invoicePreview.mimeType?.startsWith('image/') ? (
                <img
                  src={invoicePreview.url}
                  alt={invoicePreview.fileName}
                  className="mx-auto h-auto max-h-[65vh] w-auto rounded"
                />
              ) : invoicePreview.mimeType === 'application/pdf' ? (
                <iframe
                  src={invoicePreview.url}
                  title={invoicePreview.fileName}
                  className="h-[65vh] w-full rounded"
                />
              ) : (
                <div className="p-6 text-center">
                  <a href={invoicePreview.url} target="_blank" rel="noreferrer" className="ui-table-link">
                    {t('openInvoice', 'Ouvrir la facture')}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}
