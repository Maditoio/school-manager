import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication.
  // Exact '/' only — startsWith('/') would match every path and skip auth/reset checks.
  const publicRoutes = [
    '/login',
    '/reset-password',
    '/manifest.json',
    '/sw.js',
    '/workbox-',
    '/azelio-logo.png',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/apple-touch-icon.png',
    '/favicon.png',
    '/favicon.ico',
    '/api/auth',
    '/_next',
    '/public'
  ]
  const isPublicRoute =
    pathname === '/' || publicRoutes.some((route) => pathname.startsWith(route))

  if (isPublicRoute) {
    // Landing page is public, but authenticated users still need forced password reset.
    if (pathname === '/') {
      const session = await auth()
      if (session?.user?.mustResetPassword) {
        return NextResponse.redirect(new URL('/reset-password', request.url))
      }
    }
    return NextResponse.next()
  }

  // Get session
  const session = await auth()

  // Check if user is authenticated
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Handle password reset flow
  if (session.user.mustResetPassword) {
    const allowedDuringReset =
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/users/password')

    if (!allowedDuringReset) {
      return NextResponse.redirect(new URL('/reset-password', request.url))
    }
  } else if (pathname.startsWith('/reset-password')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Role-based access control
  const role = session.user.role

  // Super admin can access everything
  if (role === 'SUPER_ADMIN') {
    return NextResponse.next()
  }

  // Redirect based on role if accessing root
  if (pathname === '/') {
    switch (role) {
      case 'SCHOOL_ADMIN':
      case 'DEPUTY_ADMIN':
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      case 'FINANCE':
        return NextResponse.redirect(new URL('/finance/fees', request.url))
      case 'FINANCE_MANAGER':
        return NextResponse.redirect(new URL('/finance/expenses', request.url))
      case 'TEACHER':
        return NextResponse.redirect(new URL('/teacher/dashboard', request.url))
      case 'PARENT':
        return NextResponse.redirect(new URL('/parent/dashboard', request.url))
      case 'STUDENT':
        return NextResponse.redirect(new URL('/student/dashboard', request.url))
      default:
        return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Check role-based access to routes
  if (pathname.startsWith('/super-admin')) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  // FINANCE, FINANCE_MANAGER and TEACHER can access the meeting agenda (under /admin)
  if (
    pathname.startsWith('/admin') &&
    role !== 'SCHOOL_ADMIN' &&
    role !== 'DEPUTY_ADMIN' &&
    !(pathname === '/admin/meeting-agenda' && ['FINANCE', 'FINANCE_MANAGER', 'TEACHER'].includes(role))
  ) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  // DEPUTY_ADMIN cannot access settings or take attendance
  if (role === 'DEPUTY_ADMIN' && (
    pathname.startsWith('/admin/settings') ||
    pathname.startsWith('/admin/attendance')
  )) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  if (pathname.startsWith('/finance') && role !== 'FINANCE' && role !== 'FINANCE_MANAGER') {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (pathname.startsWith('/teacher') && role !== 'TEACHER') {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (pathname.startsWith('/parent') && role !== 'PARENT') {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (pathname.startsWith('/student') && role !== 'STUDENT') {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\..*).*)',
  ],
}
