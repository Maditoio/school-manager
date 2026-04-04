import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  const session = await auth()

  const { pathname } = request.nextUrl

  // Public routes
  const publicRoutes = ['/login', '/api/auth']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check if user is authenticated
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

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
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      case 'FINANCE':
        return NextResponse.redirect(new URL('/finance/fees', request.url))
      case 'FINANCE_MANAGER':
        return NextResponse.redirect(new URL('/finance/expenses', request.url))
      case 'TEACHER':
        return NextResponse.redirect(new URL('/teacher/dashboard', request.url))
      case 'PARENT':
        return NextResponse.redirect(new URL('/parent/dashboard', request.url))
      default:
        return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Check role-based access to routes
  if (pathname.startsWith('/super-admin')) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (pathname.startsWith('/admin') && role !== 'SCHOOL_ADMIN') {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
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
