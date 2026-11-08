'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ClassStudentsRedirectPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const classId = params?.id

  useEffect(() => {
    if (!classId) return
    router.replace(`/admin/classes/${classId}?tab=students`)
  }, [classId, router])

  return null
}
