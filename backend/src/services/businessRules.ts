import { FundDemandStatus } from '@prisma/client';
import { prisma, parsePhotoUrls } from '../utils/prisma.js';

export async function getDepartmentBalance(departmentId: string, schemeId: string) {
  const allocation = await prisma.departmentAllocation.findFirst({
    where: { departmentId, schemeId, status: 'active' },
  });
  if (!allocation) return { allocated: 0, committed: 0, remaining: 0 };

  const projects = await prisma.project.findMany({
    where: {
      departmentId,
      schemeId,
      status: { in: ['sanctioned', 'in_execution', 'completed'] },
    },
  });
  const committed = projects.reduce((s, p) => s + p.approvedCost, 0);
  return {
    allocated: allocation.allocatedAmount,
    committed,
    remaining: allocation.allocatedAmount - committed,
  };
}

export async function getSchemeAllocationTotal(schemeId: string) {
  const allocations = await prisma.departmentAllocation.findMany({ where: { schemeId } });
  return allocations.reduce((s, a) => s + a.allocatedAmount, 0);
}

export async function getProjectWorkCostTotal(projectId: string) {
  const items = await prisma.workItem.findMany({ where: { projectId } });
  return items.reduce((s, w) => s + w.workCost, 0);
}

export async function getReleasedAmountForWorkItem(workItemId: string) {
  const released = await prisma.fundDemand.findMany({
    where: { workItemId, status: FundDemandStatus.released },
  });
  return released.reduce((s, d) => s + d.demandAmount, 0);
}

export async function calculateEligibleDemandAmount(workItemId: string) {
  const workItem = await prisma.workItem.findUniqueOrThrow({
    where: { id: workItemId },
    include: { progress: { where: { verified: true }, orderBy: { submittedAt: 'desc' }, take: 1 } },
  });

  const latestVerified = workItem.progress[0];
  if (!latestVerified) return 0;

  const cumulativeEligible = (latestVerified.progressPercent / 100) * workItem.workCost;
  const previouslyReleased = await getReleasedAmountForWorkItem(workItemId);
  return Math.max(0, cumulativeEligible - previouslyReleased);
}

export async function getWalletLedger() {
  const schemes = await prisma.scheme.findMany({
    include: {
      allocations: { include: { department: true } },
      projects: {
        include: {
          workItems: {
            include: {
              demands: {
                include: { actions: true },
              },
            },
          },
        },
      },
    },
  });

  return schemes.map((scheme) => {
    const allocated = scheme.allocations.reduce((s, a) => s + a.allocatedAmount, 0);
    let demanded = 0;
    let approved = 0;
    let released = 0;

    for (const project of scheme.projects) {
      for (const work of project.workItems) {
        for (const demand of work.demands) {
          if (demand.status !== FundDemandStatus.rejected) {
            demanded += demand.demandAmount;
          }
          if (['approver', 'released'].includes(demand.status)) {
            approved += demand.demandAmount;
          }
          if (demand.status === FundDemandStatus.released) {
            released += demand.demandAmount;
          }
        }
      }
    }

    const utilised = released;
    const remaining = scheme.schemeCeilingAmount - allocated;
    let healthStatus = 'Healthy';
    if (allocated >= scheme.schemeCeilingAmount) healthStatus = 'Ceiling Reached';
    else if (allocated >= scheme.schemeCeilingAmount * 0.9) healthStatus = 'Near Ceiling';
    else if (released < allocated * 0.3) healthStatus = 'Under-utilised';

    return {
      schemeId: scheme.id,
      schemeCode: scheme.schemeCode,
      schemeName: scheme.schemeName,
      financialYear: scheme.financialYear,
      ceiling: scheme.schemeCeilingAmount,
      allocated,
      demanded,
      approved,
      released,
      utilised,
      remaining,
      healthStatus,
      departments: scheme.allocations.map((a) => ({
        departmentId: a.departmentId,
        departmentName: a.department.name,
        allocated: a.allocatedAmount,
      })),
    };
  });
}

export async function getDashboardKpis() {
  const ledger = await getWalletLedger();
  const totalSchemeFund = ledger.reduce((s, l) => s + l.ceiling, 0);
  const allocated = ledger.reduce((s, l) => s + l.allocated, 0);
  const released = ledger.reduce((s, l) => s + l.released, 0);
  const remaining = ledger.reduce((s, l) => s + l.remaining, 0);
  const pendingApprovals = await prisma.fundDemand.count({
    where: { status: { in: ['checker', 'finance', 'approver', 'queried'] } },
  });

  return { totalSchemeFund, allocated, released, remaining, pendingApprovals };
}

export function validateProgressSubmission(geoLat: number, geoLong: number, photoUrls: string[]) {
  if (geoLat == null || geoLong == null) {
    return 'Geo-tag (latitude/longitude) is mandatory';
  }
  if (!photoUrls.length) {
    return 'At least one photo is required';
  }
  return null;
}

export async function getWorkProgressStats() {
  const items = await prisma.workItem.findMany();
  const stats = { completed: 0, inProgress: 0, delayed: 0, notStarted: 0 };
  for (const item of items) {
    if (item.status === 'completed') stats.completed++;
    else if (item.status === 'in_progress') stats.inProgress++;
    else if (item.status === 'assigned') stats.delayed++;
    else stats.notStarted++;
  }
  return stats;
}
