import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { AuditResult } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { signToken, authMiddleware, getClientIp } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const router = Router();

const ROLE_LANDING: Record<string, string> = {
  STATE_PMU: '/dashboard',
  DEPARTMENT_OFFICER: '/projects',
  FIELD_OFFICER: '/work',
  CHECKER: '/fund-workflow',
  FINANCE_OFFICER: '/fund-workflow',
  APPROVER: '/fund-workflow',
  AUDITOR: '/audit',
  SYSTEM_ADMIN: '/users',
};

router.post('/login', async (req, res) => {
  const { employeeCode, password, otp } = req.body;
  if (!employeeCode || !password) {
    return res.status(400).json({ error: 'Employee code and password required' });
  }

  const user = await prisma.user.findUnique({
    where: { employeeCode },
    include: { department: true },
  });

  if (!user || user.status !== 'active') {
    await auditLog(req, 'LOGIN_FAILED', {
      entityType: 'User',
      entityId: employeeCode,
      result: AuditResult.fail,
      userId: null,
      roleAtTime: null,
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await auditLog(req, 'LOGIN_FAILED', {
      entityType: 'User',
      entityId: user.id,
      result: AuditResult.fail,
      userId: user.id,
      roleAtTime: user.role,
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.mfaEnabled && otp !== '123456') {
    await auditLog(req, 'LOGIN_OTP_FAILED', {
      entityType: 'User',
      entityId: user.id,
      result: AuditResult.fail,
      userId: user.id,
      roleAtTime: user.role,
    });
    return res.status(401).json({ error: 'Invalid OTP. Use 123456 for demo.' });
  }

  const authUser = {
    id: user.id,
    employeeCode: user.employeeCode,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
  };

  req.user = authUser;
  await auditLog(req, 'LOGIN_SUCCESS', { entityType: 'User', entityId: user.id });

  res.json({
    token: signToken(authUser),
    user: {
      ...authUser,
      email: user.email,
      departmentName: user.department?.name,
    },
    landingPage: ROLE_LANDING[user.role] || '/dashboard',
  });
});

// Demo-only: lets the "Switch Demo Role" nav control jump straight into any
// seeded account without re-entering credentials. Every user in this seed DB
// shares the same demo password, so this isn't a real access-control weakening
// here — but it must be removed (or gated behind a real admin check) before
// this app is ever pointed at production data.
router.get('/demo-users', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { status: 'active' },
    include: { department: true },
    orderBy: { role: 'asc' },
  });
  res.json(
    users.map((u) => ({
      employeeCode: u.employeeCode,
      name: u.name,
      role: u.role,
      departmentName: u.department?.name,
    }))
  );
});

router.post('/demo-login', async (req, res) => {
  const { employeeCode } = req.body;
  const user = await prisma.user.findUnique({
    where: { employeeCode },
    include: { department: true },
  });
  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Unknown demo account' });
  }

  const authUser = {
    id: user.id,
    employeeCode: user.employeeCode,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
  };

  req.user = authUser;
  await auditLog(req, 'DEMO_ROLE_SWITCH', { entityType: 'User', entityId: user.id });

  res.json({
    token: signToken(authUser),
    user: {
      ...authUser,
      email: user.email,
      departmentName: user.department?.name,
    },
    landingPage: ROLE_LANDING[user.role] || '/dashboard',
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { department: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id,
    employeeCode: user.employeeCode,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.department?.name,
    landingPage: ROLE_LANDING[user.role],
  });
});

export default router;
