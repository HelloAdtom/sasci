import { Router } from 'express';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req, res) => {
  const vendors = await prisma.vendor.findMany({
    include: { _count: { select: { projects: true, workItems: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(vendors);
});

router.post('/', requireRoles('DEPARTMENT_OFFICER', 'STATE_PMU'), async (req, res) => {
  const { name, registrationNumber, contactDetails } = req.body;
  const vendor = await prisma.vendor.create({ data: { name, registrationNumber, contactDetails } });
  await auditLog(req, 'CREATE_VENDOR', { entityType: 'Vendor', entityId: vendor.id });
  res.status(201).json(vendor);
});

router.patch('/:id', requireRoles('DEPARTMENT_OFFICER', 'STATE_PMU'), async (req, res) => {
  const { name, registrationNumber, contactDetails, active } = req.body;
  const vendor = await prisma.vendor.update({
    where: { id: req.params.id as string },
    data: {
      ...(name && { name }),
      ...(registrationNumber !== undefined && { registrationNumber }),
      ...(contactDetails !== undefined && { contactDetails }),
      ...(active !== undefined && { active }),
    },
  });
  await auditLog(req, 'UPDATE_VENDOR', { entityType: 'Vendor', entityId: vendor.id });
  res.json(vendor);
});

router.delete('/:id', requireRoles('DEPARTMENT_OFFICER', 'STATE_PMU'), async (req, res) => {
  const id = req.params.id as string;
  const [projectCount, workItemCount] = await Promise.all([
    prisma.project.count({ where: { vendorId: id } }),
    prisma.workItem.count({ where: { vendorId: id } }),
  ]);

  if (projectCount === 0 && workItemCount === 0) {
    await prisma.vendor.delete({ where: { id } });
    await auditLog(req, 'DELETE_VENDOR', { entityType: 'Vendor', entityId: id });
    return res.json({ deleted: true });
  }

  const vendor = await prisma.vendor.update({ where: { id }, data: { active: false } });
  await auditLog(req, 'DEACTIVATE_VENDOR', { entityType: 'Vendor', entityId: id });
  res.json({
    deleted: false,
    vendor,
    message: `This vendor is assigned to ${projectCount} project(s) and ${workItemCount} work item(s), so it was deactivated instead of deleted to keep those records intact.`,
  });
});

export default router;
