import NextAuth, { DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { CredentialsSignin } from "next-auth"
import { prisma } from "@/lib/prisma"
import { getPortalAccessState } from "@/lib/access-control"
import { compare, hash } from "bcryptjs"
import { UserRole } from "@prisma/client"

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials')
          return null
        }

        const normalizedEmail = String(credentials.email).trim().toLowerCase()
        const plainPassword = String(credentials.password)

        console.log('Attempting login for:', normalizedEmail)

        try {
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: { equals: normalizedEmail, mode: 'insensitive' } },
                { username: { equals: normalizedEmail, mode: 'insensitive' } },
                {
                  linkedStudent: {
                    is: {
                      admissionNumber: { equals: normalizedEmail, mode: 'insensitive' },
                    },
                  },
                },
              ],
            },
            include: { school: true },
          })

          if (!user) {
            console.log('User not found for:', normalizedEmail)
            return null
          }

          console.log('User found:', user.id, user.email, user.role)

          // Check if user is suspended
          if (user.suspended) {
            console.log('User is suspended:', user.id)
            const err = new CredentialsSignin('account_suspended')
            err.code = 'account_suspended'
            throw err
          }

          // Check if school is active (except for super admin)
          if (user.role !== 'SUPER_ADMIN' && user.school && !user.school.active) {
            console.log('School inactive for user:', user.id)
            const err = new CredentialsSignin('school_inactive')
            err.code = 'school_inactive'
            throw err
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
          const portalAccess = await getPortalAccessState({
            role: user.role,
            studentId: user.studentId ?? null,
            userId: user.id,
          })

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
        token.paymentAccessBlocked = user.paymentAccessBlocked
        token.paymentAccessReason = user.paymentAccessReason
      }

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
