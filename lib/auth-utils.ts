import { UserRole, SubscriptionPlan } from '@prisma/client'

// ============================================
// MULTI-TENANT UTILITIES
// ============================================

/**
 * Check if a user has access to a specific school
 */
export function hasSchoolAccess(userSchoolId: string | null, targetSchoolId: string): boolean {
  // Super admin can access all schools
  if (userSchoolId === null) return true
  // Regular users can only access their own school
  return userSchoolId === targetSchoolId
}

/**
 * Get school ID from user session
 */
export function getSchoolIdFromUser(user: { schoolId?: string | null; role: UserRole }): string | null {
  if (user.role === 'SUPER_ADMIN') return null
  return user.schoolId || null
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole)
}

/**
 * Check if school has access to a feature based on plan
 */
export function hasFeatureAccess(plan: SubscriptionPlan, feature: string): boolean {
  const featureMatrix = {
    BASIC: ['attendance', 'messaging', 'announcements'],
    STANDARD: ['attendance', 'messaging', 'announcements', 'results', 'reports'],
    PREMIUM: ['attendance', 'messaging', 'announcements', 'results', 'reports', 'analytics', 'branding'],
  }

  return featureMatrix[plan]?.includes(feature) || false
}

/**
 * Multi-tenant query filter
 */
export function getSchoolFilter(schoolId: string | null) {
  if (schoolId === null) {
    // Super admin - no filter
    return {}
  }
  return { schoolId }
}

// ============================================
// ROLE DEFINITIONS
// ============================================

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    'create:school',
    'manage:schools',
    'view:analytics',
    'manage:subscriptions',
  ],
  SCHOOL_ADMIN: [
    'create:teacher',
    'create:class',
    'create:subject',
    'create:student',
    'link:parent',
    'approve:results',
    'view:school-attendance',
    'create:announcement',
  ],
  FINANCE: [
    'view:fees',
    'record:payments',
    'create:fee-schedule',
    'view:expenses',
    'create:expense',
    'edit:expense',
    'audit:expenses',
  ],
  TEACHER: [
    'view:assigned-classes',
    'mark:attendance',
    'add:scores',
    'add:comments',
    'upload:homework',
    'message:parents',
  ],
  PARENT: [
    'view:child-attendance',
    'view:child-results',
    'view:performance-trends',
    'download:report',
    'view:announcements',
    'message:teacher',
  ],
}

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false
}
