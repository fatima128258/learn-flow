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
      return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    }

    const session = await authService.getSessionFromToken(token);
    if (!session) {
      return res.status(401).json({ error: 'SESSION_INVALID' });
    }

    const user = await authService.getUserById(session.userId);
    if (!user) {
      return res.status(401).json({ error: 'USER_NOT_FOUND' });
    }

    req.userId = user.id;
    const userOrganizations = await getPrisma().userOrganization.findMany({
      where: { userId: user.id },
    });
    const primaryMembership = userOrganizations.find((membership) => membership.role === 'PLATFORM_ADMIN')
      ?? userOrganizations.find((membership) => membership.role === 'ORG_ADMIN')
      ?? userOrganizations.find((membership) => membership.role === 'INSTRUCTOR')
      ?? userOrganizations[0];

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
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

export async function requireVerifiedEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });
  }

  next();
}

export async function requireOrganizationContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }

  try {
    const rawOrgId = req.params.organizationId || req.headers['x-organization-id'] || req.query.organizationId || req.body?.organizationId;
    const orgId = Array.isArray(rawOrgId) ? rawOrgId[0] : rawOrgId;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ error: 'ORGANIZATION_REQUIRED' });
    }

    if (req.user.organizationId && req.user.organizationId !== orgId) {
      return res.status(403).json({ error: 'ORGANIZATION_ACCESS_DENIED' });
    }

    const prisma = getPrisma();
    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: orgId,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!userOrg) {
      return res.status(403).json({ error: 'ORGANIZATION_ACCESS_DENIED' });
    }

    req.organizationId = orgId;
    req.user.organizationId = orgId;
    req.user.role = userOrg.role;

    next();
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    }

    if (!hasRequiredRole(req.user.role, allowedRoles)) {
      return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
    }

    next();
  };
}

export async function requirePlatformAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }

  try {
    const prisma = getPrisma();
    const adminRole = await prisma.userOrganization.findFirst({
      where: {
        userId: req.user.id,
        role: 'PLATFORM_ADMIN',
      },
    });

    if (!adminRole) {
      return res.status(403).json({ error: 'PLATFORM_ADMIN_REQUIRED' });
    }

    req.user.role = 'PLATFORM_ADMIN';
    req.user.organizationId = adminRole.organizationId;
    req.organizationId = adminRole.organizationId;

    next();
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}