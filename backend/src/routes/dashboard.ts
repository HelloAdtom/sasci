import { Router } from 'express';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import {
  getDashboardKpis,
  getWalletLedger,
  getWorkProgressStats,
} from '../services/businessRules.js';
import { prisma } from '../utils/prisma.js';

const router = Router();

router.use(authMiddleware);

router.get('/kpis', requireRoles('STATE_PMU', 'SYSTEM_ADMIN'), async (_req, res) => {
  const kpis = await getDashboardKpis();
  res.json(kpis);
});

router.get('/department-utilisation', requireRoles('STATE_PMU', 'SYSTEM_ADMIN'), async (_req, res) => {
  const allocations = await prisma.departmentAllocation.findMany({
    include: { department: true, scheme: true },
  });
  const byDept: Record<string, { name: string; allocated: number; released: number }> = {};

  for (const a of allocations) {
    if (!byDept[a.departmentId]) {
      byDept[a.departmentId] = { name: a.department.name, allocated: 0, released: 0 };
    }
    byDept[a.departmentId].allocated += a.allocatedAmount;
  }

  const ledger = await getWalletLedger();
  for (const l of ledger) {
    for (const d of l.departments) {
      if (byDept[d.departmentId]) {
        byDept[d.departmentId].released += l.released / l.departments.length;
      }
    }
  }

  res.json(Object.values(byDept));
});

router.get('/work-progress', requireRoles('STATE_PMU', 'SYSTEM_ADMIN'), async (_req, res) => {
  res.json(await getWorkProgressStats());
});

router.get('/wallet-ledger', authMiddleware, async (_req, res) => {
  res.json(await getWalletLedger());
});

export default router;
