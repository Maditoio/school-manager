import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SYSTEM_TEMPLATE_SEEDS } from '@/lib/report-template-seeds'

/**
 * Ensures all system templates exist in the database.
 * Called lazily on the first GET so no separate seeder script is needed.
 */
async function ensureSystemTemplates() {
  const existingSystem = await prisma.reportTemplate.count({ where: { isSystem: true } })
  if (existingSystem >= SYSTEM_TEMPLATE_SEEDS.length) return

  for (const seed of SYSTEM_TEMPLATE_SEEDS) {
    await prisma.reportTemplate.upsert({
      where: {
        // Use a generated stable ID based on the template name
        id: Buffer.from(`system:${seed.name}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 36).padEnd(36, '0'),
      },
      update: {
        description: seed.description,
        htmlContent: seed.htmlContent,
        cssContent: seed.cssContent,
        sortOrder: seed.sortOrder,
      },
      create: {
        id: Buffer.from(`system:${seed.name}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 36).padEnd(36, '0'),
        name: seed.name,
        description: seed.description,
        htmlContent: seed.htmlContent,
        cssContent: seed.cssContent,
        isSystem: true,
        sortOrder: seed.sortOrder,
        schoolId: null,
        createdById: null,
      },
    })
  }
}

function getAllowedSystemTemplateIds() {
  return SYSTEM_TEMPLATE_SEEDS.map((seed) =>
    Buffer.from(`system:${seed.name}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 36).padEnd(36, '0')
  )
}

// GET /api/report-templates — list all available templates for the school
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = session.user.role
    if (!['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureSystemTemplates()
    const allowedSystemTemplateIds = getAllowedSystemTemplateIds()

    const schoolId = session.user.schoolId ?? null

    // Fetch school settings to know the active template
    let activeTemplateId: string | null = null
    if (schoolId) {
      const settings = await prisma.schoolSettings.findUnique({
        where: { schoolId },
        select: { activeTemplateId: true },
      })
      activeTemplateId = settings?.activeTemplateId ?? null
    }

    // Official seeded system templates + this school's custom templates
    const templates = await prisma.reportTemplate.findMany({
      where: {
        OR: [
          { id: { in: allowedSystemTemplateIds } },
          ...(schoolId ? [{ schoolId }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        sortOrder: true,
        schoolId: true,
        createdAt: true,
        updatedAt: true,
        // omit htmlContent / cssContent from the list for performance
      },
      orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({
      templates: templates.map((t) => ({
        ...t,
        isActive: t.id === activeTemplateId,
      })),
      activeTemplateId,
    })
  } catch (error) {
    console.error('Error listing report templates:', error)
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 })
  }
}

// POST /api/report-templates — create a custom template (SCHOOL_ADMIN only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json(
        { error: 'Only school administrators can create templates' },
        { status: 403 },
      )
    }

    const schoolId = session.user.schoolId
    if (!schoolId) {
      return NextResponse.json({ error: 'School not found' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, htmlContent, cssContent } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }
    if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 })
    }
    if (name.trim().length > 80) {
      return NextResponse.json({ error: 'Template name must be 80 characters or less' }, { status: 400 })
    }

    const template = await prisma.reportTemplate.create({
      data: {
        schoolId,
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : null,
        htmlContent: htmlContent.trim(),
        cssContent: typeof cssContent === 'string' ? cssContent.trim() : null,
        isSystem: false,
        createdById: session.user.id ?? null,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Error creating report template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
