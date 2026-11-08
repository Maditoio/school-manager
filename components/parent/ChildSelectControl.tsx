'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChildSelect } from '@/components/parent/ParentShell'
import { useParentUi } from '@/lib/use-parent-ui'

export function ChildSelectControl({
  childrenOptions,
  value,
  label,
}: {
  childrenOptions: Array<{ id: string; label: string }>
  value: string
  label?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { tParent } = useParentUi()
  const resolvedLabel = label || tParent('selectChild', 'Child')

  if (childrenOptions.length <= 1) return null

  return (
    <ChildSelect
      childrenOptions={childrenOptions}
      value={value}
      label={resolvedLabel}
      onChange={(id) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('childId', id)
        router.push(`${pathname}?${params.toString()}`)
      }}
    />
  )
}
