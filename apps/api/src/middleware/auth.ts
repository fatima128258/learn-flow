import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import getPrisma from '../prisma';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'learnflow_session';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
    role?: string;
    organizationId?: string;
  };
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
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
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

// Multi-tenant context middleware - extracts organization from request
export async function requireOrganizationContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }

  try {
    // Organization ID can come from:
    // 1. Route parameter (:organizationId)
    // 2. Request header (X-Organization-Id)
    // 3. Query parameter (?organizationId=...)
    const orgId = req.params.organizationId || req.headers['x-organization-id'] || req.query.organizationId;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ error: 'ORGANIZATION_REQUIRED' });
    }

    // Verify user has access to this organization
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

    // Attach organization context to request
    req.user.organizationId = orgId;
    req.user.role = userOrg.role;

    next();
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

// Role-based authorization middleware
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    }

    if (!req.user.role) {
      return res.status(403).json({ error: 'ROLE_REQUIRED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'INSUFFICIENT_PERMISSIONS' });
    }

    next();
  };
}

// Platform admin check
export async function requirePlatformAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
  }

  try {
    const prisma = getPrisma();
    // Check if user has PLATFORM_ADMIN role in any organization (platform admins are global)
    const adminRole = await prisma.userOrganization.findFirst({
      where: {
        userId: req.user.id,
        role: 'PLATFORM_ADMIN',
      },
    });

    if (!adminRole) {
      return res.status(403).json({ error: 'PLATFORM_ADMIN_REQUIRED' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
}