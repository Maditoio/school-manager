import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')
  const academicYear = new Date().getFullYear()

  // Create Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      password: await hash('password123', 12),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
    },
  })

  console.log('✅ Created Super Admin:', superAdmin.email)

  // Create Demo School
  const school = await prisma.school.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440000' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Demo School',
      plan: 'PREMIUM',
      active: true,
    },
  })

  console.log('✅ Created School:', school.name)

  const currentAcademicYear = await prisma.academicYear.upsert({
    where: {
      schoolId_year: {
        schoolId: school.id,
        year: academicYear,
      },
    },
    update: {
      name: `Academic Year ${academicYear}`,
      isCurrent: true,
    },
    create: {
      schoolId: school.id,
      year: academicYear,
      name: `Academic Year ${academicYear}`,
      isCurrent: true,
    },
  })

  const term1 = await prisma.term.upsert({
    where: { id: '990e8400-e29b-41d4-a716-446655440001' },
    update: {
      schoolId: school.id,
      academicYearId: currentAcademicYear.id,
      name: 'Term 1',
      startDate: new Date(`${academicYear}-01-01`),
      endDate: new Date(`${academicYear}-04-30`),
      isCurrent: true,
      isLocked: false,
    },
    create: {
      id: '990e8400-e29b-41d4-a716-446655440001',
      schoolId: school.id,
      academicYearId: currentAcademicYear.id,
      name: 'Term 1',
      startDate: new Date(`${academicYear}-01-01`),
      endDate: new Date(`${academicYear}-04-30`),
      isCurrent: true,
      isLocked: false,
    },
  })

  await prisma.term.upsert({
    where: { id: '990e8400-e29b-41d4-a716-446655440002' },
    update: {
      schoolId: school.id,
      academicYearId: currentAcademicYear.id,
      name: 'Term 2',
      startDate: new Date(`${academicYear}-05-01`),
      endDate: new Date(`${academicYear}-08-31`),
      isCurrent: false,
      isLocked: false,
    },
    create: {
      id: '990e8400-e29b-41d4-a716-446655440002',
      schoolId: school.id,
      academicYearId: currentAcademicYear.id,
      name: 'Term 2',
      startDate: new Date(`${academicYear}-05-01`),
      endDate: new Date(`${academicYear}-08-31`),
      isCurrent: false,
      isLocked: false,
    },
  })

  await prisma.term.upsert({
    where: { id: '990e8400-e29b-41d4-a716-446655440003' },
    update: {
      schoolId: school.id,
      academicYearId: currentAcademicYear.id,
      name: 'Term 3',
      startDate: new Date(`${academicYear}-09-01`),
      endDate: new Date(`${academicYear}-12-31`),
      isCurrent: false,
      isLocked: false,
    },
    create: {
      id: '990e8400-e29b-41d4-a716-446655440003',
      schoolId: school.id,
      academicYearId: currentAcademicYear.id,
      name: 'Term 3',
      startDate: new Date(`${academicYear}-09-01`),
      endDate: new Date(`${academicYear}-12-31`),
      isCurrent: false,
      isLocked: false,
    },
  })

  console.log('✅ Created Academic Year and Terms')

  // Create School Admin
  const schoolAdmin = await prisma.user.upsert({
    where: { email: 'schooladmin@demo.com' },
    update: {},
    create: {
      email: 'schooladmin@demo.com',
      password: await hash('password123', 12),
      firstName: 'School',
      lastName: 'Administrator',
      role: 'SCHOOL_ADMIN',
      schoolId: school.id,
    },
  })

  console.log('✅ Created School Admin:', schoolAdmin.email)

  // Create Teacher
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@demo.com' },
    update: {},
    create: {
      email: 'teacher@demo.com',
      password: await hash('password123', 12),
      firstName: 'John',
      lastName: 'Teacher',
      role: 'TEACHER',
      schoolId: school.id,
    },
  })

  console.log('✅ Created Teacher:', teacher.email)

  // Create Parent
  const parent = await prisma.user.upsert({
    where: { email: 'parent@demo.com' },
    update: {},
    create: {
      email: 'parent@demo.com',
      password: await hash('password123', 12),
      firstName: 'Jane',
      lastName: 'Parent',
      role: 'PARENT',
      schoolId: school.id,
    },
  })

  console.log('✅ Created Parent:', parent.email)

  // Create Class
  const classData = await prisma.class.upsert({
    where: { id: '660e8400-e29b-41d4-a716-446655440000' },
    update: {},
    create: {
      id: '660e8400-e29b-41d4-a716-446655440000',
      name: 'Grade 5A',
      academicYear,
      grade: '5',
      schoolId: school.id,
      teacherId: teacher.id,
    },
  })

  console.log('✅ Created Class:', classData.name)

  // Create Subjects
  const subjects = await Promise.all([
    prisma.subject.upsert({
      where: { id: '770e8400-e29b-41d4-a716-446655440001' },
      update: {},
      create: {
        id: '770e8400-e29b-41d4-a716-446655440001',
        name: 'Mathematics',
        code: 'MATH',
        schoolId: school.id,
      },
    }),
    prisma.subject.upsert({
      where: { id: '770e8400-e29b-41d4-a716-446655440002' },
      update: {},
      create: {
        id: '770e8400-e29b-41d4-a716-446655440002',
        name: 'English',
        code: 'ENG',
        schoolId: school.id,
      },
    }),
    prisma.subject.upsert({
      where: { id: '770e8400-e29b-41d4-a716-446655440003' },
      update: {},
      create: {
        id: '770e8400-e29b-41d4-a716-446655440003',
        name: 'Science',
        code: 'SCI',
        schoolId: school.id,
      },
    }),
  ])

  console.log('✅ Created Subjects:', subjects.map(s => s.name).join(', '))

  // Create Student
  const student = await prisma.student.upsert({
    where: { id: '880e8400-e29b-41d4-a716-446655440000' },
    update: {},
    create: {
      id: '880e8400-e29b-41d4-a716-446655440000',
      firstName: 'Alice',
      lastName: 'Student',
      schoolId: school.id,
      classId: classData.id,
      academicYear,
      parentId: parent.id,
      admissionNumber: 'STU001',
      dateOfBirth: new Date('2014-05-15'),
    },
  })

  console.log('✅ Created Student:', `${student.firstName} ${student.lastName}`)

  for (const subject of subjects) {
    await prisma.classSubjectTeacher.upsert({
      where: {
        classId_subjectId: {
          classId: classData.id,
          subjectId: subject.id,
        },
      },
      update: {
        teacherId: teacher.id,
      },
      create: {
        schoolId: school.id,
        classId: classData.id,
        subjectId: subject.id,
        teacherId: teacher.id,
      },
    })
  }

  console.log('✅ Created Class Subject Teacher Assignments')

  // Create Attendance Records
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  await prisma.attendance.upsert({
    where: {
      studentId_date: {
        studentId: student.id,
        date: today,
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      studentId: student.id,
      termId: term1.id,
      date: today,
      status: 'PRESENT',
    },
  })

  await prisma.attendance.upsert({
    where: {
      studentId_date: {
        studentId: student.id,
        date: yesterday,
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      studentId: student.id,
      termId: term1.id,
      date: yesterday,
      status: 'PRESENT',
    },
  })

  console.log('✅ Created Attendance Records')

  // Create Results
  for (const subject of subjects) {
    await prisma.result.upsert({
      where: {
        studentId_subjectId_term_year: {
          studentId: student.id,
          subjectId: subject.id,
          term: '1',
          year: 2024,
        },
      },
      update: {},
      create: {
        schoolId: school.id,
        studentId: student.id,
        subjectId: subject.id,
        termId: term1.id,
        term: '1',
        year: academicYear,
        testScore: 45,
        examScore: 80,
        totalScore: 125,
        maxScore: 150,
        grade: 'B+',
        comment: 'Good performance',
        published: true,
      },
    })
  }

  console.log('✅ Created Results')

  // Create Announcement
  await prisma.announcement.create({
    data: {
      schoolId: school.id,
      title: 'Welcome to School Connect',
      message: 'This is a demo announcement. The platform is now live!',
      priority: 'high',
      createdBy: schoolAdmin.id,
    },
  })

  console.log('✅ Created Announcement')

  console.log('🎉 Seeding completed!')
  console.log('\n📧 Demo Credentials:')
  console.log('Super Admin: admin@demo.com / password123')
  console.log('School Admin: schooladmin@demo.com / password123')
  console.log('Teacher: teacher@demo.com / password123')
  console.log('Parent: parent@demo.com / password123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
