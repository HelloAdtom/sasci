import { Router } from 'express';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { getSchemeAllocationTotal } from '../services/businessRules.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const schemes = await prisma.scheme.findMany({
    include: {
      parts: true,
      allocations: { include: { department: true } },
      _count: { select: { parts: true, allocations: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const enriched = await Promise.all(
    schemes.map(async (s) => {
      const totalAllocated = await getSchemeAllocationTotal(s.id);
      let statusIndicator = 'Active';
      if (totalAllocated >= s.schemeCeilingAmount) statusIndicator = 'Ceiling Reached';
      else if (totalAllocated >= s.schemeCeilingAmount * 0.9) statusIndicator = 'Near Ceiling';
      return { ...s, totalAllocated, statusIndicator };
    })
  );
  res.json(enriched);
});

router.post('/', requireRoles('STATE_PMU'), async (req, res) => {
  const { schemeCode, schemeName, financialYear, schemeCeilingAmount, parts } = req.body;
  const scheme = await prisma.scheme.create({
    data: {
      schemeCode,
      schemeName,
      financialYear,
      schemeCeilingAmount: parseFloat(schemeCeilingAmount),
      createdById: req.user!.id,
      parts: parts?.length
        ? { create: parts.map((p: { partName: string; partDescription?: string }) => ({
            partName: p.partName,
            partDescription: p.partDescription,
          })) }
        : undefined,
    },
    include: { parts: true },
  });
  await auditLog(req, 'CREATE_SCHEME', { entityType: 'Scheme', entityId: scheme.id });
  res.status(201).json(scheme);
});

router.put('/:id', requireRoles('STATE_PMU'), async (req, res) => {
  const { schemeName, schemeCeilingAmount, status } = req.body;
  const scheme = await prisma.scheme.update({
    where: { id: req.params.id },
    data: {
      ...(schemeName && { schemeName }),
      ...(schemeCeilingAmount && { schemeCeilingAmount: parseFloat(schemeCeilingAmount) }),
      ...(status && { status }),
    },
    include: { parts: true, allocations: true },
  });
  await auditLog(req, 'UPDATE_SCHEME', { entityType: 'Scheme', entityId: scheme.id });
  res.json(scheme);
});

router.post('/:id/allocations', requireRoles('STATE_PMU'), async (req, res) => {
  const { departmentId, allocatedAmount, financialYear } = req.body;
  const amount = parseFloat(allocatedAmount);
  const scheme = await prisma.scheme.findUniqueOrThrow({ where: { id: req.params.id } });

  if (scheme.status === 'closed') {
    return res.status(400).json({ error: 'Cannot allocate to a closed scheme/FY' });
  }

  const currentTotal = await getSchemeAllocationTotal(scheme.id);
  if (currentTotal + amount > scheme.schemeCeilingAmount) {
    return res.status(400).json({
      error: 'Scheme ceiling validation failed',
      message: `Total allocation would be ₹${(currentTotal + amount).toLocaleString('en-IN')} which exceeds ceiling ₹${scheme.schemeCeilingAmount.toLocaleString('en-IN')}`,
      currentTotal,
      ceiling: scheme.schemeCeilingAmount,
    });
  }

  const allocation = await prisma.departmentAllocation.create({
    data: {
      schemeId: scheme.id,
      departmentId,
      allocatedAmount: amount,
      financialYear: financialYear || scheme.financialYear,
    },
    include: { department: true },
  });
  await auditLog(req, 'CREATE_DEPARTMENT_ALLOCATION', {
    entityType: 'DepartmentAllocation',
    entityId: allocation.id,
  });
  res.status(201).json(allocation);
});

export default router;
