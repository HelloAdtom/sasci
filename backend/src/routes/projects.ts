import { Router } from 'express';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { getDepartmentBalance, calculateEligibleDemandAmount } from '../services/businessRules.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const where: Record<string, unknown> =
    req.user!.role === 'DEPARTMENT_OFFICER' && req.user!.departmentId
      ? { departmentId: req.user!.departmentId }
      : {};
  if (req.query.schemeId) where.schemeId = req.query.schemeId as string;

  const projects = await prisma.project.findMany({
    where,
    include: {
      scheme: true,
      schemePart: true,
      department: true,
      district: true,
      vendor: true,
      workItems: true,
    },
    orderBy: { projectCode: 'asc' },
  });

  const enriched = await Promise.all(
    projects.map(async (p) => {
      const balance = await getDepartmentBalance(p.departmentId, p.schemeId);
      const workCostTotal = p.workItems.reduce((s, w) => s + w.workCost, 0);
      const costOverrun = workCostTotal > p.approvedCost;
      return { ...p, departmentBalance: balance, workCostTotal, costOverrun };
    })
  );
  res.json(enriched);
});

router.get('/:id', async (req, res) => {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: req.params.id as string },
    include: {
      scheme: true,
      schemePart: true,
      department: true,
      district: true,
      vendor: true,
      workItems: {
        include: {
          vendor: true,
          assignments: { include: { assignedOfficer: true }, orderBy: { assignedDate: 'desc' }, take: 1 },
          progress: { where: { verified: true }, orderBy: { submittedAt: 'desc' }, take: 1 },
        },
      },
    },
  });
  if (req.user!.role === 'DEPARTMENT_OFFICER' && project.departmentId !== req.user!.departmentId) {
    return res.status(403).json({ error: "Not your department's project" });
  }

  const balance = await getDepartmentBalance(project.departmentId, project.schemeId);
  const workItems = await Promise.all(
    project.workItems.map(async (w) => ({
      ...w,
      assignedOfficer: w.assignments[0]?.assignedOfficer ?? null,
      progressPercent: w.progress[0]?.progressPercent ?? 0,
      eligibleDemandAmount: await calculateEligibleDemandAmount(w.id),
    }))
  );

  res.json({ ...project, workItems, departmentBalance: balance });
});

router.post('/', requireRoles('DEPARTMENT_OFFICER', 'STATE_PMU', 'SYSTEM_ADMIN'), async (req, res) => {
  const {
    projectCode,
    projectName,
    schemeId,
    schemePartId,
    departmentId,
    districtId,
    approvedCost,
    geoLat,
    geoLong,
    vendorId,
  } = req.body;

  const deptId = req.user!.role === 'DEPARTMENT_OFFICER' ? req.user!.departmentId! : departmentId;
  const cost = parseFloat(approvedCost);

  const scheme = await prisma.scheme.findUniqueOrThrow({ where: { id: schemeId } });
  if (scheme.status === 'closed') {
    return res.status(400).json({ error: 'Cannot create project under closed FY/scheme' });
  }

  const balance = await getDepartmentBalance(deptId, schemeId);
  if (cost > balance.remaining) {
    return res.status(400).json({
      error: 'Department allocation limit exceeded',
      message: `Approved cost ₹${cost.toLocaleString('en-IN')} exceeds remaining department balance ₹${balance.remaining.toLocaleString('en-IN')}`,
      balance,
    });
  }

  const project = await prisma.project.create({
    data: {
      projectCode,
      projectName,
      schemeId,
      schemePartId: schemePartId || null,
      departmentId: deptId,
      districtId,
      approvedCost: cost,
      geoLat: geoLat ? parseFloat(geoLat) : null,
      geoLong: geoLong ? parseFloat(geoLong) : null,
      vendorId: vendorId || null,
      status: 'sanctioned',
      createdById: req.user!.id,
      sanctionedById: req.user!.id,
      sanctionedAt: new Date(),
    },
    include: { scheme: true, department: true, district: true, vendor: true },
  });

  await auditLog(req, 'CREATE_PROJECT', { entityType: 'Project', entityId: project.id });
  res.status(201).json(project);
});

router.patch('/:id', requireRoles('DEPARTMENT_OFFICER', 'STATE_PMU', 'SYSTEM_ADMIN'), async (req, res) => {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: req.params.id as string } });
  if (req.user!.role === 'DEPARTMENT_OFFICER' && project.departmentId !== req.user!.departmentId) {
    return res.status(403).json({ error: "Not your department's project" });
  }

  const { projectName, approvedCost, vendorId, districtId, active } = req.body;

  if (approvedCost !== undefined) {
    const newCost = parseFloat(approvedCost);
    const balance = await getDepartmentBalance(project.departmentId, project.schemeId);
    const availableForThis = balance.remaining + project.approvedCost;
    if (newCost > availableForThis) {
      return res.status(400).json({
        error: 'Department allocation limit exceeded',
        message: `Approved cost ₹${newCost.toLocaleString('en-IN')} exceeds remaining department balance ₹${availableForThis.toLocaleString('en-IN')}`,
      });
    }
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      ...(projectName && { projectName }),
      ...(approvedCost !== undefined && { approvedCost: parseFloat(approvedCost) }),
      ...(vendorId !== undefined && { vendorId: vendorId || null }),
      ...(districtId && { districtId }),
      ...(active !== undefined && { active }),
    },
    include: { scheme: true, department: true, district: true, vendor: true },
  });
  await auditLog(req, 'UPDATE_PROJECT', { entityType: 'Project', entityId: updated.id });
  res.json(updated);
});

router.patch('/:id/sanction', requireRoles('DEPARTMENT_OFFICER', 'STATE_PMU', 'SYSTEM_ADMIN'), async (req, res) => {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: req.params.id as string } });
  const balance = await getDepartmentBalance(project.departmentId, project.schemeId);

  if (project.approvedCost > balance.remaining) {
    return res.status(400).json({
      error: 'Insufficient department balance for sanction',
      balance,
    });
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { status: 'sanctioned', sanctionedById: req.user!.id, sanctionedAt: new Date() },
  });
  await auditLog(req, 'SANCTION_PROJECT', { entityType: 'Project', entityId: project.id });
  res.json(updated);
});

export default router;
