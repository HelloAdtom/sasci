import { Request } from 'express';
import { AuditResult } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { getClientIp } from './auth.js';

export async function auditLog(
  req: Request,
  action: string,
  opts: {
    entityType?: string;
    entityId?: string;
    result?: AuditResult;
    userId?: string | null;
    roleAtTime?: string | null;
  } = {}
) {
  const userId = opts.userId !== undefined ? opts.userId : req.user?.id ?? null;
  const roleAtTime = opts.roleAtTime !== undefined ? opts.roleAtTime : req.user?.role ?? null;

  await prisma.auditLog.create({
    data: {
      userId,
      roleAtTime,
      action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      result: opts.result ?? AuditResult.success,
      ipAddress: getClientIp(req),
    },
  });
}
