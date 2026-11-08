import { redirect } from 'next/navigation'

/** Terms are managed in Settings — keep this route for old bookmarks. */
export default function TermsPage() {
  redirect('/admin/settings')
}
