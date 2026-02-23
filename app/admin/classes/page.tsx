'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

interface Class {
  id: string
  name: string
  teacherId: string
  teacher?: { firstName: string; lastName: string }
  _count?: { students: number }
}

interface Teacher {
  id: string
  firstName: string
  lastName: string
}

export default function ClassesPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const [classes, setClasses] = useState<Class[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    teacherId: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
    if (session?.user?.role !== 'SCHOOL_ADMIN') {
      redirect('/login')
    }
  }, [session, status])

  useEffect(() => {
    if (session) {
      fetchClasses()
      fetchTeachers()
    }
  }, [session])

  const fetchClasses = async () => {
    try {
      const res = await fetch('/api/classes')
      if (res.ok) {
        const data = await res.json()
        setClasses(Array.isArray(data.classes) ? data.classes : [])
      } else {
        setClasses([])
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error)
      setClasses([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/users?role=TEACHER')
      if (res.ok) {
        const data = await res.json()
        setTeachers(Array.isArray(data.users) ? data.users : [])
      } else {
        setTeachers([])
      }
    } catch (error) {
      console.error('Failed to fetch teachers:', error)
      setTeachers([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : '/api/classes'
      const method = editingClass ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        await fetchClasses()
        setShowModal(false)
        resetForm()
        showToast('Class saved successfully!', 'success')
      } else {
        const error = await res.json()
        showToast(error.error || 'Failed to save class', 'error')
      }
    } catch (error) {
      console.error('Failed to save class:', error)
      showToast('Failed to save class', 'error')
    }
  }

  const handleEdit = (cls: Class) => {
    setEditingClass(cls)
    setFormData({
      name: cls.name,
      teacherId: cls.teacherId,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return
    
    try {
      const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (res.ok || res.status === 202) {
        // 202 means deletion request created
        showToast(
          data.message || 
          'Class deletion request submitted. Awaiting approval from another admin.',
          'success'
        )
        await fetchClasses()
      } else {
        showToast(data.error || 'Failed to delete class', 'error')
      }
    } catch (error) {
      console.error('Failed to delete class:', error)
      showToast('Failed to delete class', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      teacherId: '',
    })
    setEditingClass(null)
  }

  if (status === 'loading' || !session) {
    return <div>Loading...</div>
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Students', href: '/admin/students', icon: '👨‍🎓' },
    { label: 'Teachers', href: '/admin/teachers', icon: '👨‍🏫' },
    { label: 'Classes', href: '/admin/classes', icon: '🏫' },
    { label: 'Subjects', href: '/admin/subjects', icon: '📚' },
    { label: 'Attendance', href: '/admin/attendance', icon: '📅' },
    { label: 'Results', href: '/admin/results', icon: '📝' },
    { label: 'Announcements', href: '/admin/announcements', icon: '📢' },
    { label: 'Messages', href: '/admin/messages', icon: '💬' },
  ]

  return (
    <DashboardLayout
      user={{
        name: `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || 'Admin',
        role: 'School Admin',
        email: session.user.email,
      }}
      navItems={navItems}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Classes Management</h1>
            <p className="text-gray-600 mt-2">Manage all classes in your school</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/admin/deletion-requests"
              className="ui-button ui-button-secondary h-8 px-3.5 text-[13px] inline-flex items-center justify-center"
            >
              Deletion Requests
            </a>
            <Button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
            >
              Add Class
            </Button>
          </div>
        </div>

        {loading ? (
          <div>Loading classes...</div>
        ) : classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <Card key={cls.id} className="p-6">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-gray-900">{cls.name}</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>👨‍🏫 Teacher: {cls.teacher ? `${cls.teacher.firstName} ${cls.teacher.lastName}` : 'N/A'}</p>
                    <p>👨‍🎓 Students: {cls._count?.students || 0}</p>
                  </div>
                  <div className="flex gap-2 pt-3">
                    <a
                      href={`/admin/classes/${cls.id}/students`}
                      className="ui-button ui-button-secondary h-7 px-3 text-[13px] inline-flex items-center justify-center"
                    >
                      Students
                    </a>
                    <a
                      href={`/admin/classes/${cls.id}/subjects`}
                      className="ui-button ui-button-secondary h-7 px-3 text-[13px] inline-flex items-center justify-center"
                    >
                      Subjects
                    </a>
                    <Button size="sm" variant="secondary" onClick={() => handleEdit(cls)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(cls.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-gray-500">No classes found. Click &quot;Add Class&quot; to create one.</p>
          </Card>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
              <h2 className="text-2xl font-bold mb-4">
                {editingClass ? 'Edit Class' : 'Add Class'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Class Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Grade 5A"
                />
                <Select
                  label="Class Teacher"
                  value={formData.teacherId}
                  onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                  required
                >
                  <option value="">Select Teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </Select>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">{editingClass ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
