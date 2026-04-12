import FeeInvoicePage from '@/app/admin/fees/invoice/[id]/page'

export default async function StudentFeeInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return <FeeInvoicePage params={params} />
}
