import FeeInvoicePage from '@/app/admin/fees/invoice/[id]/page'

export default async function FinanceFeeInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return <FeeInvoicePage params={params} />
}