import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import getPrisma from '../prisma';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'learnflow_session';
const ROLE_PRIORITY: Record<string, number> = {
  STUDENT: 1,
  INSTRUCTOR: 2,
  ORG_ADMIN: 3,
  PLATFORM_ADMIN: 4,
};

export interface AuthenticatedRequest extends Request {
  userId?: string;
  organizationId?: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
    createdAt?: Date;
    role?: string;
    organizationId?: string;
  };
  // Cache auth context within single request lifecycle to avoid duplicate queries
  __authCache?: {
    userOrganizations?: Array<{
      id: string;
      userId: string;
      organizationId: string;
      role: string;
      organization: {
        id: string;
        slug: string;
        name: string;
      };
    }>;
  };
}

export function hasRequiredRole(userRole: string | undefined, allowedRoles: string[]) {
  if (!userRole) return false;
  const userLevel = ROLE_PRIORITY[userRole];
  if (userLevel === undefined) return false;

  return allowedRoles.some((role) => {
    const requiredLevel = ROLE_PRIORITY[role];
    return requiredLevel !== undefined && userLevel >= requiredLevel;
  });
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME] || null;
    if (!token) {
      return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
    }

    const session = await authService.getSessionFromToken(token);
    if (!session) {
      return res.status(401).json({ success: false, error: 'SESSION_INVALID' });
    }

    const user = await authService.getUserById(session.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'USER_NOT_FOUND' });
    }

    req.userId = user.id;
    
    // Get user's organization memberships with organization details
    // Use request-level cache to avoid duplicate queries within same request
    const prisma = getPrisma();
    let userOrganizations = req.__authCache?.userOrganizations;
    
    if (!userOrganizations) {
      userOrganizations = await prisma.userOrganization.findMany({
        where: { userId: user.id },
        include: {
          organization: true,
        },
      });
      // Cache for reuse in other middleware (requireOrgAdmin, etc.) within same request
      if (!req.__authCache) {
        req.__authCache = {};
      }
      req.__authCache.userOrganizations = userOrganizations;
    }
    
    // Filter out platform organizations for non-platform-admin users
    const validMemberships = userOrganizations.filter((membership) => {
      // Platform admins can have platform organization as their context
      if (membership.role === 'PLATFORM_ADMIN') {
        return true;
      }
      // Non-platform-admin users should not have platform organization as their context
      return membership.organization.slug !== 'platform';
    });
    
    const primaryMembership = validMemberships.find((membership) => membership.role === 'PLATFORM_ADMIN')
      ?? validMemberships.find((membership) => membership.role === 'ORG_ADMIN')
      ?? validMemberships.find((membership) => membership.role === 'INSTRUCTOR')
      ?? validMemberships[0];

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      role: primaryMembership?.role,
      organizationId: primaryMembership?.organizationId,
    };

    next();
  } catch {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function requireVerifiedEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({ success: false, error: 'EMAIL_NOT_VERIFIED' });
  }

  next();
}

export async function requireOrganizationContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
  }

  try {
    // Accept organizationId only from the URL path parameter or the explicit
    // X-Organization-Id header (used by the platform-admin dashboard to act on
    // behalf of a specific org). Accepting it from req.query or req.body would
    // allow any client to inject an arbitrary tenant context.
    const rawOrgId = req.params.organizationId || req.headers['x-organization-id'];
    const orgId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;

    // If no organization ID provided in request, use the user's organization ID from session
    const finalOrgId = orgId && typeof orgId === 'string' ? orgId : req.user.organizationId;
    
    if (!finalOrgId || typeof finalOrgId !== 'string') {
      return res.status(400).json({ success: false, error: 'ORGANIZATION_REQUIRED' });
    }

    const prisma = getPrisma();
    const platformAdminMembership = await prisma.userOrganization.findFirst({
      where: {
        userId: req.user.id,
        role: 'PLATFORM_ADMIN',
      },
    });

    if (platformAdminMembership) {
      const organization = await prisma.organization.findUnique({
        where: { id: finalOrgId },
      });

      if (!organization) {
        return res.status(404).json({ success: false, error: 'ORGANIZATION_NOT_FOUND' });
      }

      req.organizationId = finalOrgId;
      req.user.organizationId = finalOrgId;
      req.user.role = 'PLATFORM_ADMIN';
      return next();
    }

    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: finalOrgId,
        },
      },
    });

    if (!userOrg) {
      return res.status(403).json({ success: false, error: 'ORGANIZATION_ACCESS_DENIED' });
    }

    req.organizationId = finalOrgId;
    req.user.organizationId = finalOrgId;
    req.user.role = userOrg.role;

    next();
  } catch {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
    }

    if (!hasRequiredRole(req.user.role, allowedRoles)) {
      return res.status(403).json({ success: false, error: 'INSUFFICIENT_PERMISSIONS' });
    }

    next();
  };
}

export async function requirePlatformAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
  }

  try {
    const prisma = getPrisma();
    
    // Use cached user organizations from requireAuth middleware to avoid duplicate query
    const userOrganizations = req.__authCache?.userOrganizations;
    let adminRole;
    
    if (userOrganizations) {
      adminRole = userOrganizations.find((m) => m.role === 'PLATFORM_ADMIN');
    } else {
      // Fallback: query if cache not available
      adminRole = await prisma.userOrganization.findFirst({
        where: {
          userId: req.user.id,
          role: 'PLATFORM_ADMIN',
        },
      });
    }

    if (!adminRole) {
      return res.status(403).json({ success: false, error: 'PLATFORM_ADMIN_REQUIRED' });
    }

    req.user.role = 'PLATFORM_ADMIN';
    req.user.organizationId = adminRole.organizationId;
    req.organizationId = adminRole.organizationId;

    next();
  } catch {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

export async function requireOrgAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'NOT_AUTHENTICATED' });
  }

  try {
    const prisma = getPrisma();

    // Accept organizationId only from the URL path parameter or the explicit
    // X-Organization-Id header. Accepting it from req.query or req.body would
    // allow any client to inject an arbitrary tenant context.
    const rawOrgId = req.headers['x-organization-id'] || req.params.organizationId;
    const orgId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;

    // If no organization ID provided in request, use the user's organization ID from session
    const finalOrgId = orgId && typeof orgId === 'string' ? orgId : req.user.organizationId;
    
    if (!finalOrgId || typeof finalOrgId !== 'string') {
      return res.status(400).json({ success: false, error: 'ORGANIZATION_REQUIRED' });
    }

    // Use cached user organizations from requireAuth middleware to avoid duplicate query
    const userOrganizations = req.__authCache?.userOrganizations;
    
    if (userOrganizations) {
      // Check platform admin from cache
      const platformAdminMembership = userOrganizations.find(
        (m) => m.role === 'PLATFORM_ADMIN'
      );

      if (platformAdminMembership) {
        const organization = await prisma.organization.findUnique({
          where: { id: finalOrgId },
        });

        if (!organization) {
          return res.status(404).json({ success: false, error: 'ORGANIZATION_NOT_FOUND' });
        }

        req.user.role = 'PLATFORM_ADMIN';
        req.user.organizationId = finalOrgId;
        req.organizationId = finalOrgId;
        return next();
      }

      // Check org admin from cache
      const membership = userOrganizations.find(
        (m) => m.organizationId === finalOrgId && m.role === 'ORG_ADMIN'
      );

      if (membership) {
        req.user.role = 'ORG_ADMIN';
        req.user.organizationId = finalOrgId;
        req.organizationId = finalOrgId;
        return next();
      }

      // Check if they have any role in this org but not admin
      const hasOrgMembership = userOrganizations.find(
        (m) => m.organizationId === finalOrgId
      );

      if (hasOrgMembership && hasOrgMembership.role !== 'ORG_ADMIN') {
        return res.status(403).json({ success: false, error: 'ORG_ADMIN_REQUIRED' });
      }

      // No membership in this org
      return res.status(403).json({ success: false, error: 'ORG_ADMIN_REQUIRED' });
    }

    // Fallback: query if cache not available (shouldn't happen if requireAuth ran first)
    const platformAdminMembership = await prisma.userOrganization.findFirst({
      where: {
        userId: req.user.id,
        role: 'PLATFORM_ADMIN',
      },
    });

    if (platformAdminMembership) {
      const organization = await prisma.organization.findUnique({
        where: { id: finalOrgId },
      });

      if (!organization) {
        return res.status(404).json({ success: false, error: 'ORGANIZATION_NOT_FOUND' });
      }

      req.user.role = 'PLATFORM_ADMIN';
      req.user.organizationId = finalOrgId;
      req.organizationId = finalOrgId;
      return next();
    }

    // Check if user has ORG_ADMIN role for the specific organization
    const membership = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: finalOrgId,
        },
      },
    });

    if (!membership || membership.role !== 'ORG_ADMIN') {
      return res.status(403).json({ success: false, error: 'ORG_ADMIN_REQUIRED' });
    }

    req.user.role = 'ORG_ADMIN';
    req.user.organizationId = finalOrgId;
    req.organizationId = finalOrgId;

    next();
  } catch {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}