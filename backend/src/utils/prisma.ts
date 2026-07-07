import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export function parsePhotoUrls(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializePhotoUrls(urls: string[]): string {
  return JSON.stringify(urls);
}
