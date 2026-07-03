import { Router } from 'express';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(authMiddleware);

router.get('/', requireRoles('AUDITOR', 'STATE_PMU', 'SYSTEM_ADMIN'), async (req, res) => {
  const { from, to, role, entityType, result } = req.query;
  const where: Record<string, unknown> = {};

  if (from || to) {
    where.timestamp = {};
    if (from) (where.timestamp as Record<string, Date>).gte = new Date(from as string);
    if (to) (where.timestamp as Record<string, Date>).lte = new Date(to as string);
  }
  if (role) where.roleAtTime = role;
  if (entityType) where.entityType = entityType;
  if (result) where.result = result;

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, employeeCode: true } } },
    orderBy: { timestamp: 'desc' },
    take: 500,
  });

  if (req.query.export === 'pdf') {
    await auditLog(req, 'EXPORT_AUDIT_TRAIL', { entityType: 'AuditLog' });
  }

  res.json(logs);
});

export default router;
