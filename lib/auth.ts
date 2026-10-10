import NextAuth, { DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { CredentialsSignin } from "next-auth"
import { prisma } from "@/lib/prisma"
import { getPortalAccessState } from "@/lib/access-control"
import { normalizeSchoolCode } from "@/lib/school-login"
import { compare, hash } from "bcryptjs"
import { UserRole, Prisma } from "@prisma/client"

type AuthUserRecord = Prisma.UserGetPayload<{ include: { school: true } }>

async function getUserAuthFlags(userId: string) {
  const rows = await prisma.$queryRaw<Array<{
    preferred_language: string | null
    must_reset_password: boolean | null
  }>>`
    SELECT
      COALESCE(us.preferred_language, u.preferred_language, 'en') AS preferred_language,
      u.must_reset_password
    FROM users u
    LEFT JOIN user_settings us ON us.user_id = u.id
    WHERE u.id = ${userId}
    LIMIT 1
  `

  return rows[0] ?? { preferred_language: 'en', must_reset_password: false }
}

function throwAuthCode(code: string): never {
  const err = new CredentialsSignin(code)
  err.code = code
  throw err
}

/**
 * Resolve login by username or admission number with school scoping.
 * Never picks an arbitrary first match when admission numbers collide across schools.
 */
async function resolveUsernameOrAdmissionLogin(
  identifier: string,
  schoolIdFilter: string | null,
): Promise<AuthUserRecord | null> {
  const studentsWithAdmission = await prisma.student.findMany({
    where: {
      admissionNumber: { equals: identifier, mode: 'insensitive' },
      ...(schoolIdFilter ? { schoolId: schoolIdFilter } : {}),
    },
    select: {
      id: true,
      schoolId: true,
      userId: true,
      academicYear: true,
      user: { include: { school: true } },
    },
    orderBy: { academicYear: 'desc' },
  })

  const schoolIds = [...new Set(studentsWithAdmission.map((s) => s.schoolId))]

  // Fail closed: bare admission login is unsafe when the number exists at multiple schools.
  if (!schoolIdFilter && schoolIds.length > 1) {
    throwAuthCode('school_required')
  }

  const usernameUsers = await prisma.user.findMany({
    where: {
      username: { equals: identifier, mode: 'insensitive' },
      ...(schoolIdFilter ? { schoolId: schoolIdFilter } : {}),
    },
    include: { school: true },
  })

  const byId = new Map<string, AuthUserRecord>()
  for (const student of studentsWithAdmission) {
    if (student.user) byId.set(student.user.id, student.user)
  }
  for (const user of usernameUsers) {
    byId.set(user.id, user)
  }

  let candidates = [...byId.values()]
  if (schoolIdFilter) {
    candidates = candidates.filter((u) => u.schoolId === schoolIdFilter)
  }

  if (candidates.length === 0) return null

  if (candidates.length === 1) return candidates[0]

  // Prefer exact username match when still ambiguous within a school.
  const exactUsername = candidates.filter(
    (u) => u.username?.toLowerCase() === identifier.toLowerCase(),
  )
  if (exactUsername.length === 1) return exactUsername[0]

  throwAuthCode('school_required')
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      role: UserRole
      schoolId: string | null
      preferredLanguage: string
      mustResetPassword: boolean
      firstName: string | null
      lastName: string | null
      studentId: string | null
      paymentAccessBlocked: boolean
      paymentAccessReason: string | null
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email: string
    role: UserRole
    schoolId: string | null
    preferredLanguage: string
    mustResetPassword: boolean
    firstName: string | null
    lastName: string | null
    studentId: string | null
    paymentAccessBlocked: boolean
    paymentAccessReason: string | null
  }
}

const NEXTAUTH_URL =
  process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  '43eb2c8b82455b61983b548370adab249bbf5aae126fc53b1d479355a392e7b2'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        schoolCode: { label: "School code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials')
          return null
        }

        const normalizedEmail = String(credentials.email).trim().toLowerCase()
        const rawIdentifier = String(credentials.email).trim()
        const plainPassword = String(credentials.password)
        const schoolCodeInput = credentials.schoolCode
          ? normalizeSchoolCode(String(credentials.schoolCode))
          : ''

        // Teachers without email often log in with phone; accept spaced formats.
        const phoneUsername = (() => {
          if (!/^\+?[\d\s()-]{7,}$/.test(rawIdentifier)) return null
          const hasPlus = rawIdentifier.startsWith('+')
          const digits = rawIdentifier.replace(/\D/g, '')
          if (digits.length < 7) return null
          return hasPlus ? `+${digits}` : digits
        })()

        console.log('Attempting login for:', normalizedEmail)

        try {
          let schoolIdFilter: string | null = null
          if (schoolCodeInput) {
            const school = await prisma.school.findUnique({
              where: { code: schoolCodeInput },
              select: { id: true },
            })
            if (!school) {
              console.log('Invalid school code:', schoolCodeInput)
              return null
            }
            schoolIdFilter = school.id
          }

          let user: AuthUserRecord | null = null

          if (normalizedEmail.includes('@')) {
            user = await prisma.user.findFirst({
              where: {
                email: { equals: normalizedEmail, mode: 'insensitive' },
                ...(schoolIdFilter ? { schoolId: schoolIdFilter } : {}),
              },
              include: { school: true },
            })
          } else if (phoneUsername) {
            user = await prisma.user.findFirst({
              where: {
                OR: [
                  { username: { equals: normalizedEmail, mode: 'insensitive' } },
                  { username: { equals: phoneUsername, mode: 'insensitive' } },
                ],
                ...(schoolIdFilter ? { schoolId: schoolIdFilter } : {}),
              },
              include: { school: true },
            })
          } else {
            // Admission number / username — never unscoped findFirst on admission alone.
            user = await resolveUsernameOrAdmissionLogin(rawIdentifier, schoolIdFilter)
          }

          if (!user) {
            console.log('User not found for:', normalizedEmail)
            return null
          }

          console.log('User found:', user.id, user.email, user.role)

          // Check if user is suspended
          if (user.suspended) {
            console.log('User is suspended:', user.id)
            throwAuthCode('account_suspended')
          }

          // Check if school is active (except for super admin)
          if (user.role !== 'SUPER_ADMIN' && user.school && !user.school.active) {
            console.log('School inactive for user:', user.id)
            throwAuthCode('school_inactive')
          }

          let isPasswordValid = false

          if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
            isPasswordValid = await compare(plainPassword, user.password)
          } else {
            isPasswordValid = user.password === plainPassword
            if (isPasswordValid) {
              console.log('Upgrading password hash for user:', user.id)
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  password: await hash(plainPassword, 12),
                },
              })
            }
          }

          if (!isPasswordValid) {
            console.log('Invalid password for user:', user.id)
            return null
          }

          console.log('Password valid for user:', user.id)

          const flags = await getUserAuthFlags(user.id)
          const portalAccess = await getPortalAccessState()

          console.log('Login successful for user:', user.id)

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
            preferredLanguage: flags.preferred_language || 'en',
            mustResetPassword: Boolean(flags.must_reset_password),
            firstName: user.firstName,
            lastName: user.lastName,
            studentId: user.studentId ?? null,
            paymentAccessBlocked: portalAccess.blocked,
            paymentAccessReason: portalAccess.reason,
          }
        } catch (error) {
          console.error('Auth error:', error)
          throw error
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: updateData }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.role = user.role
        token.schoolId = user.schoolId
        token.preferredLanguage = user.preferredLanguage
        token.mustResetPassword = user.mustResetPassword
        token.firstName = user.firstName
        token.lastName = user.lastName
        token.studentId = user.studentId
        token.paymentAccessBlocked = false
        token.paymentAccessReason = null
      }

      token.paymentAccessBlocked = false
      token.paymentAccessReason = null

      if (trigger === 'update') {
        if (updateData?.preferredLanguage) {
          token.preferredLanguage = updateData.preferredLanguage
        }
        if (updateData?.mustResetPassword !== undefined) {
          token.mustResetPassword = updateData.mustResetPassword
        }
      }

      // Ensure default values for required fields
      if (token.paymentAccessBlocked === undefined || token.paymentAccessBlocked === null) {
        token.paymentAccessBlocked = false
      }
      if (token.paymentAccessReason === undefined) {
        token.paymentAccessReason = null
      }
      if (token.preferredLanguage === undefined) {
        token.preferredLanguage = 'en'
      }
      if (token.mustResetPassword === undefined) {
        token.mustResetPassword = false
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.role = token.role as UserRole
        session.user.schoolId = token.schoolId as string | null
        session.user.preferredLanguage = (token.preferredLanguage as string) || 'en'
        session.user.mustResetPassword = Boolean(token.mustResetPassword)
        session.user.firstName = token.firstName as string | null
        session.user.lastName = token.lastName as string | null
        session.user.studentId = token.studentId as string | null
        session.user.paymentAccessBlocked = Boolean(token.paymentAccessBlocked)
        session.user.paymentAccessReason = (token.paymentAccessReason as string | null) ?? null
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: NEXTAUTH_SECRET,
})
