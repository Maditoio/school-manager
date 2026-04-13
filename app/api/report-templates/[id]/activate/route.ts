import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SYSTEM_TEMPLATE_SEEDS } from '@/lib/report-template-seeds'

function getAllowedSystemTemplateIds() {
  return SYSTEM_TEMPLATE_SEEDS.map((seed) =>
    Buffer.from(`system:${seed.name}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 36).padEnd(36, '0')
  )
}

// POST /api/report-templates/[id]/activate — set a template as the active one for this school
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json(
        { error: 'Only school administrators can change the active template' },
        { status: 403 },
      )
    }

    const schoolId = session.user.schoolId
    if (!schoolId) {
      return NextResponse.json({ error: 'School not found' }, { status: 400 })
    }

    const { id } = await params
    const allowedSystemTemplateIds = getAllowedSystemTemplateIds()

    // Verify the template is accessible to this school
    const template = await prisma.reportTemplate.findFirst({
      where: {
        id,
        OR: [
          { id: { in: allowedSystemTemplateIds } },
          { schoolId },
        ],
      },
      select: { id: true, name: true },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Upsert school settings with the new active template
    await prisma.schoolSettings.upsert({
      where: { schoolId },
      update: { activeTemplateId: id },
      create: {
        schoolId,
        activeTemplateId: id,
      },
    })

    return NextResponse.json({ success: true, activeTemplateId: id, templateName: template.name })
  } catch (error) {
    console.error('Error activating report template:', error)
    return NextResponse.json({ error: 'Failed to activate template' }, { status: 500 })
  }
}
