import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import {
  calculateEligibleDemandAmount,
  getProjectWorkCostTotal,
} from '../services/businessRules.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  // Every role can see every work item — no assignment/department scoping.
  // (Previously Field Officers only saw items they were assigned to, which
  // meant a work item they'd just created themselves was invisible to them,
  // since creating one doesn't assign you to it.)
  const items = await prisma.workItem.findMany({
    include: {
      project: { include: { scheme: true } },
      assignments: { include: { assignedOfficer: true } },
      progress: { where: { verified: true }, orderBy: { submittedAt: 'desc' }, take: 1 },
      demands: true,
      vendor: true,
    },
  });

  const enriched = await Promise.all(
    items.map(async (item) => {
      const projectWorkTotal = await getProjectWorkCostTotal(item.projectId);
      const eligibleDemand = await calculateEligibleDemandAmount(item.id);
      const validationPass = item.workCost + (projectWorkTotal - item.workCost) <= item.project.approvedCost;
      return {
        ...item,
        projectApprovedCost: item.project.approvedCost,
        validationPass,
        eligibleDemandAmount: eligibleDemand,
        assignedOfficer: item.assignments[0]?.assignedOfficer ?? null,
      };
    })
  );
  res.json(enriched);
});

router.post('/', async (req, res) => {
  const { workCode, projectId, workName, workCost, vendorId } = req.body;
  const cost = parseFloat(workCost);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { workItems: true },
  });

  const currentTotal = project.workItems.reduce((s, w) => s + w.workCost, 0);
  if (currentTotal + cost > project.approvedCost) {
    return res.status(400).json({
      error: 'Work cost validation failed',
      message: `Total work cost would be ₹${(currentTotal + cost).toLocaleString('en-IN')} exceeding project approved cost ₹${project.approvedCost.toLocaleString('en-IN')}`,
      currentTotal,
      approvedCost: project.approvedCost,
    });
  }

  const item = await prisma.workItem.create({
    data: { workCode, projectId, workName, workCost: cost, vendorId: vendorId || null },
    include: { project: true, vendor: true },
  });
  await auditLog(req, 'CREATE_WORK_ITEM', { entityType: 'WorkItem', entityId: item.id });
  res.status(201).json(item);
});

router.patch('/:id', async (req, res) => {
  const item = await prisma.workItem.findUniqueOrThrow({
    where: { id: req.params.id as string },
    include: { project: { include: { workItems: true } } },
  });
  const { workName, workCost, active, vendorId } = req.body;

  if (workCost !== undefined) {
    const newCost = parseFloat(workCost);
    const otherItemsTotal = item.project.workItems
      .filter((w) => w.id !== item.id)
      .reduce((s, w) => s + w.workCost, 0);
    if (otherItemsTotal + newCost > item.project.approvedCost) {
      return res.status(400).json({
        error: 'Work cost validation failed',
        message: `Total work cost would be ₹${(otherItemsTotal + newCost).toLocaleString('en-IN')} exceeding project approved cost ₹${item.project.approvedCost.toLocaleString('en-IN')}`,
      });
    }
  }

  const updated = await prisma.workItem.update({
    where: { id: item.id },
    data: {
      ...(workName && { workName }),
      ...(workCost !== undefined && { workCost: parseFloat(workCost) }),
      ...(active !== undefined && { active }),
      ...(vendorId !== undefined && { vendorId: vendorId || null }),
    },
    include: { project: true, vendor: true },
  });
  await auditLog(req, 'UPDATE_WORK_ITEM', { entityType: 'WorkItem', entityId: updated.id });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id as string;
  const [assignmentCount, progressCount, demandCount] = await Promise.all([
    prisma.workAssignment.count({ where: { workItemId: id } }),
    prisma.progressEntry.count({ where: { workItemId: id } }),
    prisma.fundDemand.count({ where: { workItemId: id } }),
  ]);

  if (assignmentCount === 0 && progressCount === 0 && demandCount === 0) {
    await prisma.workItem.delete({ where: { id } });
    await auditLog(req, 'DELETE_WORK_ITEM', { entityType: 'WorkItem', entityId: id });
    return res.json({ deleted: true });
  }

  const updated = await prisma.workItem.update({ where: { id }, data: { active: false } });
  await auditLog(req, 'DEACTIVATE_WORK_ITEM', { entityType: 'WorkItem', entityId: id });
  res.json({
    deleted: false,
    workItem: updated,
    message: 'This work item already has assignment, progress, or fund demand history, so it was deactivated instead of deleted to keep that history intact.',
  });
});

router.post('/:id/assign', async (req, res) => {
  const { assignedOfficerId, targetCompletionDate } = req.body;
  const assignment = await prisma.workAssignment.create({
    data: {
      workItemId: req.params.id as string,
      assignedOfficerId,
      targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
    },
    include: { assignedOfficer: true, workItem: true },
  });
  await prisma.workItem.update({
    where: { id: req.params.id as string },
    data: { status: 'assigned' },
  });
  await auditLog(req, 'ASSIGN_WORK_ITEM', { entityType: 'WorkAssignment', entityId: assignment.id });
  res.status(201).json(assignment);
});

router.get('/:id/eligible-demand', authMiddleware, async (req, res) => {
  const eligible = await calculateEligibleDemandAmount(req.params.id as string);
  const workItem = await prisma.workItem.findUniqueOrThrow({
    where: { id: req.params.id as string },
    include: {
      progress: { where: { verified: true }, orderBy: { submittedAt: 'desc' }, take: 1 },
    },
  });
  res.json({
    workItemId: workItem.id,
    workCost: workItem.workCost,
    latestVerifiedProgress: workItem.progress[0]?.progressPercent ?? 0,
    eligibleDemandAmount: eligible,
    formula: '(latest verified progress% × work_cost) − previously released',
  });
});

router.get('/field-officers', async (req, res) => {
  const where =
    req.user!.role === 'DEPARTMENT_OFFICER' && req.user!.departmentId
      ? { role: 'FIELD_OFFICER' as const, status: 'active', departmentId: req.user!.departmentId }
      : { role: 'FIELD_OFFICER' as const, status: 'active' };
  const officers = await prisma.user.findMany({
    where,
    select: { id: true, name: true, employeeCode: true },
  });
  res.json(officers);
});

export default router;
