import NextAuth, { DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { CredentialsSignin } from "next-auth"
import { prisma } from "@/lib/prisma"
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
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const normalizedEmail = String(credentials.email).trim().toLowerCase()
        const plainPassword = String(credentials.password)

        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: normalizedEmail,
              mode: 'insensitive',
            },
          },
          include: { school: true },
        })

        if (!user) {
          return null
        }

        // Check if user is suspended
        if (user.suspended) {
          const err = new CredentialsSignin('account_suspended')
          err.code = 'account_suspended'
          throw err
        }

        // Check if school is active (except for super admin)
        if (user.role !== 'SUPER_ADMIN' && user.school && !user.school.active) {
          return null
        }

        let isPasswordValid = false

        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
          isPasswordValid = await compare(plainPassword, user.password)
        } else {
          isPasswordValid = user.password === plainPassword
          if (isPasswordValid) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                password: await hash(plainPassword, 12),
              },
            })
          }
        }

        if (!isPasswordValid) {
          return null
        }

        const flags = await getUserAuthFlags(user.id)

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
          preferredLanguage: flags.preferred_language || 'en',
          mustResetPassword: Boolean(flags.must_reset_password),
          firstName: user.firstName,
          lastName: user.lastName,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.role = user.role
        token.schoolId = user.schoolId
        token.preferredLanguage = user.preferredLanguage
        token.mustResetPassword = user.mustResetPassword
        token.firstName = user.firstName
        token.lastName = user.lastName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.role = token.role as UserRole
        session.user.schoolId = token.schoolId as string | null
        session.user.preferredLanguage = (token.preferredLanguage as string) || 'en'
        session.user.mustResetPassword = Boolean(token.mustResetPassword)
        session.user.firstName = token.firstName as string | null
        session.user.lastName = token.lastName as string | null
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
})
