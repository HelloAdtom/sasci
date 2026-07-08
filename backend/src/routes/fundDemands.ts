import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { FundDemandStatus, ApprovalStage, ApprovalActionType } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { calculateEligibleDemandAmount } from '../services/businessRules.js';
import { prisma } from '../utils/prisma.js';

const upload = multer({ dest: 'uploads/' });
const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const demands = await prisma.fundDemand.findMany({
    include: {
      workItem: {
        include: {
          project: { include: { scheme: true, district: true, department: true } },
          progress: {
            include: {
              submittedBy: { select: { name: true, employeeCode: true } },
              documents: { include: { uploadedBy: { select: { name: true, employeeCode: true } } } },
            },
            orderBy: { submittedAt: 'desc' },
          },
        },
      },
      raisedBy: { select: { id: true, name: true, employeeCode: true } },
      actions: { include: { officer: { select: { id: true, name: true, role: true } } }, orderBy: { timestamp: 'asc' } },
      documents: { include: { uploadedBy: { select: { name: true, employeeCode: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const filtered =
    req.user!.role === 'FIELD_OFFICER'
      ? demands.filter((d) => d.raisedById === req.user!.id)
      : req.user!.role === 'CHECKER'
        ? demands.filter((d) => d.status === 'checker')
        : req.user!.role === 'FINANCE_OFFICER'
          ? demands.filter((d) => d.status === 'finance')
          : req.user!.role === 'APPROVER'
            ? demands.filter((d) => d.status === 'approver')
            : demands;

  res.json(filtered);
});

router.post('/', upload.array('documents', 5), async (req, res) => {
  const { workItemId, demandAmount, documentType } = req.body;
  const amount = parseFloat(demandAmount);

  const verifiedProgress = await prisma.progressEntry.findFirst({
    where: { workItemId, verified: true },
  });
  if (!verifiedProgress) {
    return res.status(400).json({
      error: 'At least one verified progress entry with geo-tag and photo is required',
    });
  }

  const eligible = await calculateEligibleDemandAmount(workItemId);
  if (amount > eligible) {
    return res.status(400).json({
      error: 'Demand exceeds eligible amount',
      eligibleDemandAmount: eligible,
      requested: amount,
    });
  }

  const count = await prisma.fundDemand.count();
  const demandCode = `FD-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const demand = await prisma.fundDemand.create({
    data: {
      demandCode,
      workItemId,
      raisedById: req.user!.id,
      demandAmount: amount,
      eligibleDemandAmount: eligible,
      status: FundDemandStatus.checker,
      actions: {
        create: {
          stage: ApprovalStage.maker,
          officerId: req.user!.id,
          action: ApprovalActionType.submitted,
          remarks: 'Demand raised by maker',
        },
      },
    },
    include: { actions: true, workItem: { include: { project: true } } },
  });

  const files = req.files as Express.Multer.File[] | undefined;
  if (files?.length) {
    await prisma.document.createMany({
      data: files.map((f) => ({
        fileUrl: `/uploads/${path.basename(f.path)}`,
        fileName: f.originalname,
        documentType: documentType || 'other',
        uploadedById: req.user!.id,
        fundDemandId: demand.id,
      })),
    });
  }

  await auditLog(req, 'RAISE_FUND_DEMAND', { entityType: 'FundDemand', entityId: demand.id });
  res.status(201).json(demand);
});

router.post('/:id/action', async (req, res) => {
  const { action, remarks } = req.body;
  const demand = await prisma.fundDemand.findUniqueOrThrow({
    where: { id: req.params.id as string },
    include: { actions: { orderBy: { timestamp: 'asc' } }, raisedBy: true },
  });

  const ACTIONABLE_STATUSES = ['checker', 'finance', 'approver'];
  if (!ACTIONABLE_STATUSES.includes(demand.status)) {
    return res.status(400).json({ error: 'Demand is not awaiting reviewer action at this stage' });
  }
  const currentStage = demand.status as unknown as ApprovalStage;

  // Self-approval prevention: the maker can never review their own demand, and no
  // single officer (relevant mainly to the STATE_PMU override, which can act at
  // any stage) may hold two *different* reviewer stages on the same demand. Acting
  // again at the *same* stage is allowed — that's exactly what happens when a
  // reviewer queries a demand and later re-reviews it after the maker resubmits.
  if (req.user!.id === demand.raisedById) {
    return res.status(400).json({ error: 'Self-approval prevention: the officer who raised this demand cannot also review it.' });
  }
  const actedAtDifferentStage = demand.actions.some(
    (a) => a.stage !== ApprovalStage.maker && a.stage !== currentStage && a.officerId === req.user!.id
  );
  if (actedAtDifferentStage) {
    return res.status(400).json({ error: 'Self-approval prevention: you already acted on this demand at a different stage.' });
  }

  // Idempotency is scoped to the current review cycle — a resubmission after a
  // query starts a fresh cycle, so the same reviewer acting again at the same
  // stage post-resubmit is a new, valid action, not a duplicate.
  let currentCycleActions = demand.actions;
  for (let i = demand.actions.length - 1; i >= 0; i--) {
    if (demand.actions[i].action === ApprovalActionType.resubmitted) {
      currentCycleActions = demand.actions.slice(i + 1);
      break;
    }
  }
  const existingAction = currentCycleActions.find((a) => a.stage === currentStage && a.officerId === req.user!.id);
  if (existingAction) {
    return res.status(400).json({ error: 'Idempotent: action already recorded at this stage' });
  }

  if (action === 'rejected') {
    const updated = await prisma.fundDemand.update({
      where: { id: demand.id },
      data: {
        status: FundDemandStatus.rejected,
        actions: { create: { stage: currentStage, officerId: req.user!.id, action: ApprovalActionType.rejected, remarks } },
      },
      include: { actions: { include: { officer: true }, orderBy: { timestamp: 'asc' } } },
    });
    await auditLog(req, 'REJECT_FUND_DEMAND', { entityType: 'FundDemand', entityId: demand.id });
    return res.json(updated);
  }

  if (action === 'query') {
    const updated = await prisma.fundDemand.update({
      where: { id: demand.id },
      data: {
        status: FundDemandStatus.queried,
        actions: { create: { stage: currentStage, officerId: req.user!.id, action: ApprovalActionType.queried, remarks } },
      },
      include: { actions: { include: { officer: true }, orderBy: { timestamp: 'asc' } } },
    });
    await auditLog(req, 'QUERY_FUND_DEMAND', { entityType: 'FundDemand', entityId: demand.id });
    return res.json(updated);
  }

  const nextStatus: Record<string, FundDemandStatus> = {
    checker: FundDemandStatus.finance,
    finance: FundDemandStatus.approver,
    approver: FundDemandStatus.released,
  };
  const actionType: Record<string, ApprovalActionType> = {
    checker: ApprovalActionType.verified,
    finance: ApprovalActionType.validated,
    approver: ApprovalActionType.approved,
  };
  const newStatus = nextStatus[demand.status];

  const updated = await prisma.fundDemand.update({
    where: { id: demand.id },
    data: {
      status: newStatus,
      actions: { create: { stage: currentStage, officerId: req.user!.id, action: actionType[demand.status], remarks } },
    },
    include: {
      actions: { include: { officer: true }, orderBy: { timestamp: 'asc' } },
      workItem: { include: { project: { include: { scheme: true } } } },
    },
  });

  await auditLog(req, `FUND_DEMAND_${demand.status.toUpperCase()}`, {
    entityType: 'FundDemand',
    entityId: demand.id,
  });
  res.json(updated);
});

router.post('/:id/resubmit', async (req, res) => {
  const { demandAmount, remarks } = req.body;
  const demand = await prisma.fundDemand.findUniqueOrThrow({
    where: { id: req.params.id as string },
    include: { actions: { orderBy: { timestamp: 'asc' } } },
  });

  if (demand.status !== 'queried') {
    return res.status(400).json({ error: 'Demand is not awaiting a response' });
  }
  if (demand.raisedById !== req.user!.id) {
    return res.status(403).json({ error: 'Only the officer who raised this demand can resubmit it' });
  }

  const lastQuery = [...demand.actions].reverse().find((a) => a.action === ApprovalActionType.queried);
  const returnStage = lastQuery?.stage ?? ApprovalStage.checker;

  let newAmount: number | undefined;
  if (demandAmount !== undefined && demandAmount !== '') {
    const eligible = await calculateEligibleDemandAmount(demand.workItemId);
    newAmount = parseFloat(demandAmount);
    if (newAmount > eligible) {
      return res.status(400).json({ error: 'Demand exceeds eligible amount', eligibleDemandAmount: eligible, requested: newAmount });
    }
  }

  const updated = await prisma.fundDemand.update({
    where: { id: demand.id },
    data: {
      ...(newAmount !== undefined && { demandAmount: newAmount }),
      status: returnStage as unknown as FundDemandStatus,
      actions: { create: { stage: ApprovalStage.maker, officerId: req.user!.id, action: ApprovalActionType.resubmitted, remarks } },
    },
    include: { actions: { include: { officer: true }, orderBy: { timestamp: 'asc' } } },
  });

  await auditLog(req, 'RESUBMIT_FUND_DEMAND', { entityType: 'FundDemand', entityId: demand.id });
  res.json(updated);
});

export default router;
