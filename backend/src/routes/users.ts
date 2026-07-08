import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(authMiddleware);

function isDeptOfficerOwnFieldOfficer(req: import('express').Request, target: { role: string; departmentId: string | null }) {
  return (
    req.user!.role === 'DEPARTMENT_OFFICER' &&
    target.role === 'FIELD_OFFICER' &&
    target.departmentId === req.user!.departmentId
  );
}

router.get('/', async (req, res) => {
  const where =
    req.user!.role === 'DEPARTMENT_OFFICER' && req.user!.departmentId
      ? { role: 'FIELD_OFFICER' as const, departmentId: req.user!.departmentId }
      : {};
  const users = await prisma.user.findMany({
    where,
    include: { department: true },
    orderBy: { employeeCode: 'asc' },
  });
  res.json(users.map(({ passwordHash, ...u }) => u));
});

router.post('/', async (req, res) => {
  const { employeeCode, name, email, password } = req.body;
  let { role, departmentId } = req.body;

  if (req.user!.role === 'DEPARTMENT_OFFICER') {
    role = 'FIELD_OFFICER';
    departmentId = req.user!.departmentId;
  }

  const passwordHash = await bcrypt.hash(password || 'password123', 10);
  const user = await prisma.user.create({
    data: {
      employeeCode,
      name,
      email,
      passwordHash,
      role,
      departmentId: departmentId || null,
    },
    include: { department: true },
  });
  await auditLog(req, 'CREATE_USER', { entityType: 'User', entityId: user.id });
  const { passwordHash: _, ...safe } = user;
  res.status(201).json(safe);
});

router.patch('/:id', async (req, res) => {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id as string } });

  if (req.user!.role === 'DEPARTMENT_OFFICER') {
    if (!isDeptOfficerOwnFieldOfficer(req, target)) {
      return res.status(403).json({ error: "Not a member of your department's team" });
    }
    const { name, status } = req.body;
    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(name && { name }),
        ...(status && { status }),
      },
      include: { department: true },
    });
    await auditLog(req, 'UPDATE_USER', { entityType: 'User', entityId: user.id });
    const { passwordHash: _, ...safe } = user;
    return res.json(safe);
  }

  const { role, departmentId, status, mfaEnabled, name } = req.body;
  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(role && { role }),
      ...(departmentId !== undefined && { departmentId }),
      ...(status && { status }),
      ...(mfaEnabled !== undefined && { mfaEnabled }),
      ...(name && { name }),
    },
    include: { department: true },
  });
  await auditLog(req, 'UPDATE_USER', { entityType: 'User', entityId: user.id });
  const { passwordHash: _, ...safe } = user;
  res.json(safe);
});

router.delete('/:id', async (req, res) => {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id as string } });

  if (req.user!.role === 'DEPARTMENT_OFFICER' && !isDeptOfficerOwnFieldOfficer(req, target)) {
    return res.status(403).json({ error: "Not a member of your department's team" });
  }

  const [assignmentCount, progressCount, demandCount] = await Promise.all([
    prisma.workAssignment.count({ where: { assignedOfficerId: target.id } }),
    prisma.progressEntry.count({ where: { submittedById: target.id } }),
    prisma.fundDemand.count({ where: { raisedById: target.id } }),
  ]);

  if (assignmentCount === 0 && progressCount === 0 && demandCount === 0) {
    await prisma.user.delete({ where: { id: target.id } });
    await auditLog(req, 'DELETE_USER', { entityType: 'User', entityId: target.id });
    return res.json({ deleted: true });
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data: { status: 'inactive' } });
  await auditLog(req, 'DEACTIVATE_USER', { entityType: 'User', entityId: target.id });
  const { passwordHash: _, ...safe } = updated;
  res.json({
    deleted: false,
    user: safe,
    message: 'This user has assignment, progress, or fund demand history, so they were deactivated instead of deleted to keep that history intact.',
  });
});

router.get('/:id/profile', async (req, res) => {
  const target = await prisma.user.findUniqueOrThrow({
    where: { id: req.params.id as string },
    include: { department: true },
  });

  const allowed =
    req.user!.id === target.id ||
    req.user!.role === 'SYSTEM_ADMIN' ||
    req.user!.role === 'STATE_PMU' ||
    isDeptOfficerOwnFieldOfficer(req, target);
  if (!allowed) {
    return res.status(403).json({ error: 'Not authorised to view this profile' });
  }

  const assignments = await prisma.workAssignment.findMany({
    where: { assignedOfficerId: target.id },
    include: {
      workItem: {
        include: {
          project: { include: { scheme: true } },
          progress: { where: { verified: true }, orderBy: { submittedAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { assignedDate: 'desc' },
  });

  const workItems = assignments.map((a) => ({
    id: a.workItem.id,
    workCode: a.workItem.workCode,
    workName: a.workItem.workName,
    status: a.workItem.status,
    projectName: a.workItem.project.projectName,
    schemeName: a.workItem.project.scheme.schemeName,
    progressPercent: a.workItem.progress[0]?.progressPercent ?? 0,
    targetCompletionDate: a.targetCompletionDate,
  }));

  const projects = Array.from(new Map(workItems.map((w) => [w.projectName, w.projectName])).keys());
  const currentTasks = workItems.filter((w) => w.status === 'assigned' || w.status === 'in_progress');
  const completedTasks = workItems.filter((w) => w.status === 'completed');
  const avgProgress = workItems.length
    ? Math.round(workItems.reduce((s, w) => s + w.progressPercent, 0) / workItems.length)
    : 0;

  const { passwordHash: _, ...safeTarget } = target;
  res.json({
    user: safeTarget,
    assignedProjects: projects,
    assignedWorkItems: workItems,
    currentTasks,
    completedTasks,
    averageProgress: avgProgress,
  });
});

export default router;
