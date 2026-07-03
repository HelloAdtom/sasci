import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { validateProgressSubmission } from '../services/businessRules.js';
import { prisma, serializePhotoUrls } from '../utils/prisma.js';

const upload = multer({ dest: 'uploads/' });
const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  let where = {};
  if (req.user!.role === 'FIELD_OFFICER') {
    where = { submittedById: req.user!.id };
  }

  const entries = await prisma.progressEntry.findMany({
    where,
    include: {
      workItem: { include: { project: { include: { scheme: true } } } },
      submittedBy: { select: { id: true, name: true, employeeCode: true } },
      documents: { include: { uploadedBy: { select: { name: true, employeeCode: true } } } },
    },
    orderBy: { submittedAt: 'desc' },
  });
  res.json(entries);
});

router.post(
  '/',
  requireRoles('FIELD_OFFICER'),
  upload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'documents', maxCount: 5 },
  ]),
  async (req, res) => {
    const { workItemId, progressPercent, geoLat, geoLong, milestoneNote, documentType } = req.body;
    const files = (req.files as Record<string, Express.Multer.File[]> | undefined) ?? {};
    const photoUrls = files.photos?.map((f) => `/uploads/${path.basename(f.path)}`) ??
      (req.body.photoUrls ? JSON.parse(req.body.photoUrls) : []);

    const validationError = validateProgressSubmission(
      parseFloat(geoLat),
      parseFloat(geoLong),
      photoUrls
    );
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const assignment = await prisma.workAssignment.findFirst({
      where: { workItemId, assignedOfficerId: req.user!.id },
    });
    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to this work item' });
    }

    const entry = await prisma.progressEntry.create({
      data: {
        workItemId,
        submittedById: req.user!.id,
        progressPercent: parseFloat(progressPercent),
        geoLat: parseFloat(geoLat),
        geoLong: parseFloat(geoLong),
        photoUrls: serializePhotoUrls(photoUrls),
        milestoneNote,
        verified: false,
      },
      include: { workItem: true },
    });

    if (files.documents?.length) {
      await prisma.document.createMany({
        data: files.documents.map((f) => ({
          fileUrl: `/uploads/${path.basename(f.path)}`,
          fileName: f.originalname,
          documentType: documentType || 'other',
          uploadedById: req.user!.id,
          progressEntryId: entry.id,
        })),
      });
    }

    await prisma.workItem.update({
      where: { id: workItemId },
      data: { status: 'in_progress' },
    });

    await auditLog(req, 'SUBMIT_PROGRESS', { entityType: 'ProgressEntry', entityId: entry.id });
    res.status(201).json(entry);
  }
);

router.patch('/:id/verify', requireRoles('CHECKER', 'STATE_PMU'), async (req, res) => {
  const entry = await prisma.progressEntry.update({
    where: { id: req.params.id as string },
    data: { verified: true },
    include: { workItem: true },
  });
  await auditLog(req, 'VERIFY_PROGRESS', { entityType: 'ProgressEntry', entityId: entry.id });
  res.json(entry);
});

export default router;
