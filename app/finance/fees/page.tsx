import AdminFeesPage from '@/app/admin/fees/page'

export default function FinanceFeesPage() {
  return <AdminFeesPage routePrefix="/finance" allowedRoles={['FINANCE', 'FINANCE_MANAGER']} navMode="finance" />
}