import { Router } from 'express';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { getDepartmentBalance } from '../services/businessRules.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const departments = await prisma.department.findMany({
    include: {
      state: true,
      allocations: { include: { scheme: true } },
      _count: { select: { projects: true } },
    },
  });

  const enriched = await Promise.all(
    departments.map(async (d) => {
      const schemeProjects = await prisma.project.findMany({
        where: { departmentId: d.id, schemeId: { in: d.allocations.map((a) => a.schemeId) } },
        select: { id: true, projectCode: true, projectName: true, approvedCost: true, status: true, schemeId: true },
      });
      const balances = await Promise.all(
        d.allocations.map(async (a) => ({
          schemeId: a.schemeId,
          schemeName: a.scheme.schemeName,
          projects: schemeProjects.filter((p) => p.schemeId === a.schemeId),
          ...(await getDepartmentBalance(d.id, a.schemeId)),
        }))
      );
      return { ...d, balances };
    })
  );
  res.json(enriched);
});

router.get('/states', async (_req, res) => {
  res.json(await prisma.state.findMany({ include: { districts: true } }));
});

router.post('/', requireRoles('STATE_PMU'), async (req, res) => {
  const { name, reportingStructure } = req.body;
  const state = await prisma.state.findFirstOrThrow();
  const department = await prisma.department.create({
    data: { name, reportingStructure, stateId: state.id },
    include: { state: true },
  });
  await auditLog(req, 'CREATE_DEPARTMENT', { entityType: 'Department', entityId: department.id });
  res.status(201).json(department);
});

router.patch('/:id', requireRoles('STATE_PMU'), async (req, res) => {
  const { name, reportingStructure, active } = req.body;
  const department = await prisma.department.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(reportingStructure !== undefined && { reportingStructure }),
      ...(active !== undefined && { active }),
    },
    include: { state: true },
  });
  await auditLog(req, 'UPDATE_DEPARTMENT', { entityType: 'Department', entityId: department.id });
  res.json(department);
});

export default router;
