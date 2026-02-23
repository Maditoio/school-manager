'use client'

import { ReactNode } from 'react'

type ResourceType = 'assessment' | 'announcement'

type TrackedInteractionLinkProps = {
  href: string
  resourceType: ResourceType
  resourceId: string
  childId?: string | null
  metadata?: Record<string, unknown>
  className?: string
  children: ReactNode
}

export function TrackedInteractionLink({
  href,
  resourceType,
  resourceId,
  childId,
  metadata,
  className,
  children,
}: TrackedInteractionLinkProps) {
  const handleClick = async () => {
    const payload = {
      childId,
      resourceType,
      resourceId,
      action: 'click',
      metadata,
    }

    try {
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json',
        })
        navigator.sendBeacon('/api/parent-interactions', blob)
        return
      }

      await fetch('/api/parent-interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        keepalive: true,
      })
    } catch {
      // Non-blocking analytics tracking
    }
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
