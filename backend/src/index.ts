import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Prisma } from '@prisma/client';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import schemeRoutes from './routes/schemes.js';
import departmentRoutes from './routes/departments.js';
import projectRoutes from './routes/projects.js';
import workItemRoutes from './routes/workItems.js';
import progressRoutes from './routes/progress.js';
import fundDemandRoutes from './routes/fundDemands.js';
import userRoutes from './routes/users.js';
import vendorRoutes from './routes/vendors.js';
import auditRoutes from './routes/audit.js';
import reportRoutes from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/work-items', workItemRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/fund-demands', fundDemandRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'SASCI API' }));

// Express 5 forwards rejected promises from async route handlers here
// automatically, so this one handler covers every route — no per-route
// try/catch needed. Translates the Prisma error codes hit by normal user
// action (duplicate codes/emails, acting on an already-deleted record) into
// a clean message instead of leaking a raw 500 to the frontend.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(', ') : 'value';
      return res.status(409).json({ error: `A record with this ${target} already exists — choose a different one.` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'That record no longer exists — it may have been deleted or changed by someone else.' });
    }
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`SASCI API running on http://localhost:${PORT}`);
});
