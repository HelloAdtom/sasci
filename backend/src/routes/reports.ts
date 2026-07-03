import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getWalletLedger } from '../services/businessRules.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(authMiddleware);

router.get('/scheme-allocation', async (_req, res) => {
  const ledger = await getWalletLedger();
  res.json(
    ledger.map((l) => ({
      scheme: l.schemeName,
      ceiling: l.ceiling,
      allocated: l.allocated,
      released: l.released,
      utilised: l.utilised,
      balance: l.ceiling - l.released,
    }))
  );
});

router.get('/department-expenditure', async (_req, res) => {
  const allocations = await prisma.departmentAllocation.findMany({
    include: { department: true, scheme: true },
  });
  res.json(
    allocations.map((a) => ({
      department: a.department.name,
      scheme: a.scheme.schemeName,
      allocated: a.allocatedAmount,
      financialYear: a.financialYear,
    }))
  );
});

router.get('/project-status', async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: {
      scheme: true,
      district: true,
      workItems: { include: { progress: { where: { verified: true }, orderBy: { submittedAt: 'desc' }, take: 1 } } },
    },
  });
  res.json(
    projects.map((p) => {
      const avgProgress =
        p.workItems.length > 0
          ? p.workItems.reduce((s, w) => s + (w.progress[0]?.progressPercent ?? 0), 0) / p.workItems.length
          : 0;
      return {
        projectId: p.id,
        project: p.projectName,
        scheme: p.scheme.schemeName,
        district: p.district.name,
        status: p.status,
        percentComplete: Math.round(avgProgress),
        departmentId: p.departmentId,
      };
    })
  );
});

router.get('/pending-approvals', async (_req, res) => {
  const stages = ['checker', 'finance', 'approver', 'queried'] as const;
  const result = [];
  for (const stage of stages) {
    const pending = await prisma.fundDemand.findMany({
      where: { status: stage },
      orderBy: { createdAt: 'asc' },
    });
    if (pending.length === 0) {
      result.push({ stage, count: 0, avgDaysStuck: 0, oldestItem: null });
      continue;
    }
    const now = Date.now();
    const days = pending.map((d) => (now - d.createdAt.getTime()) / 86400000);
    result.push({
      stage,
      count: pending.length,
      avgDaysStuck: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
      oldestItem: pending[0].demandCode,
    });
  }
  res.json(result);
});

router.get('/demand-history', async (_req, res) => {
  const demands = await prisma.fundDemand.findMany({
    include: {
      actions: { include: { officer: true }, orderBy: { timestamp: 'asc' } },
      workItem: { include: { project: { include: { scheme: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(demands);
});

export default router;
