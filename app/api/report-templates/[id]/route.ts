import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SYSTEM_TEMPLATE_SEEDS } from '@/lib/report-template-seeds'

function getAllowedSystemTemplateIds() {
  return SYSTEM_TEMPLATE_SEEDS.map((seed) =>
    Buffer.from(`system:${seed.name}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 36).padEnd(36, '0')
  )
}

// GET /api/report-templates/[id] — fetch a single template (with full HTML/CSS)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = session.user.role
    if (!['SCHOOL_ADMIN', 'DEPUTY_ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const schoolId = session.user.schoolId ?? null
    const allowedSystemTemplateIds = getAllowedSystemTemplateIds()

    const template = await prisma.reportTemplate.findFirst({
      where: {
        id,
        OR: [
          { id: { in: allowedSystemTemplateIds } },
          ...(schoolId ? [{ schoolId }] : []),
        ],
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error fetching report template:', error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

// PUT /api/report-templates/[id] — update a custom template (SCHOOL_ADMIN only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json(
        { error: 'Only school administrators can update templates' },
        { status: 403 },
      )
    }

    const { id } = await params
    const schoolId = session.user.schoolId
    if (!schoolId) {
      return NextResponse.json({ error: 'School not found' }, { status: 400 })
    }

    const existing = await prisma.reportTemplate.findFirst({
      where: { id, schoolId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found or you do not have permission to edit it' },
        { status: 404 },
      )
    }

    if (existing.isSystem) {
      return NextResponse.json({ error: 'System templates cannot be modified' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, htmlContent, cssContent } = body

    const updateData: {
      name?: string
      description?: string | null
      htmlContent?: string
      cssContent?: string | null
    } = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Template name cannot be empty' }, { status: 400 })
      }
      if (name.trim().length > 80) {
        return NextResponse.json({ error: 'Template name must be 80 characters or less' }, { status: 400 })
      }
      updateData.name = name.trim()
    }

    if (description !== undefined) {
      updateData.description = typeof description === 'string' ? description.trim() : null
    }

    if (htmlContent !== undefined) {
      if (typeof htmlContent !== 'string' || htmlContent.trim().length === 0) {
        return NextResponse.json({ error: 'HTML content cannot be empty' }, { status: 400 })
      }
      updateData.htmlContent = htmlContent.trim()
    }

    if (cssContent !== undefined) {
      updateData.cssContent = typeof cssContent === 'string' ? cssContent.trim() : null
    }

    const template = await prisma.reportTemplate.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error updating report template:', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

// DELETE /api/report-templates/[id] — delete a custom template (SCHOOL_ADMIN only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json(
        { error: 'Only school administrators can delete templates' },
        { status: 403 },
      )
    }

    const { id } = await params
    const schoolId = session.user.schoolId
    if (!schoolId) {
      return NextResponse.json({ error: 'School not found' }, { status: 400 })
    }

    const existing = await prisma.reportTemplate.findFirst({
      where: { id, schoolId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found or you do not have permission to delete it' },
        { status: 404 },
      )
    }

    if (existing.isSystem) {
      return NextResponse.json({ error: 'System templates cannot be deleted' }, { status: 403 })
    }

    // If this template is the active one, clear the school's activeTemplateId
    await prisma.$transaction([
      prisma.schoolSettings.updateMany({
        where: { schoolId, activeTemplateId: id },
        data: { activeTemplateId: null },
      }),
      prisma.reportTemplate.delete({ where: { id } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting report template:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
