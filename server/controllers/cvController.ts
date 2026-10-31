import type { Response, NextFunction } from 'express';
import {
  createCVRecord,
  deleteUserCV,
  getUserCVById,
  listUserCVs,
  updateUserCV,
} from '../../src/db/repositories.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/errorHandler.ts';
import { generateATSCVPdfBuffer } from '../services/pdfService.ts';
import { saveCVSchema } from '../validators/schemas.ts';

export async function createCVHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const parsed = saveCVSchema.parse(req.body);
    const cv = await createCVRecord({
      userId: req.user.uid,
      title: parsed.title,
      templateId: parsed.templateId,
      data: parsed.data,
    });
    res.status(201).json({ cv });
  } catch (err) {
    next(err);
  }
}

export async function listCVsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const result = await listUserCVs(req.user.uid, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCVHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const cvId = Number(req.params.id);
    if (!Number.isInteger(cvId) || cvId <= 0) {
      throw new HttpError(400, 'Invalid CV ID.');
    }
    const cv = await getUserCVById(cvId, req.user.uid);
    if (!cv) {
      throw new HttpError(404, 'CV not found.');
    }
    res.json({ cv });
  } catch (err) {
    next(err);
  }
}

export async function updateCVHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const cvId = Number(req.params.id);
    if (!Number.isInteger(cvId) || cvId <= 0) {
      throw new HttpError(400, 'Invalid CV ID.');
    }
    const parsed = saveCVSchema.parse(req.body);
    const updated = await updateUserCV(cvId, req.user.uid, {
      title: parsed.title,
      templateId: parsed.templateId,
      data: parsed.data,
    });
    if (!updated) {
      throw new HttpError(404, 'CV not found.');
    }
    res.json({ cv: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteCVHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const cvId = Number(req.params.id);
    if (!Number.isInteger(cvId) || cvId <= 0) {
      throw new HttpError(400, 'Invalid CV ID.');
    }
    const deleted = await deleteUserCV(cvId, req.user.uid);
    if (!deleted) {
      throw new HttpError(404, 'CV not found.');
    }
    res.json({ success: true, id: cvId });
  } catch (err) {
    next(err);
  }
}

export async function downloadCVPdfHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const cvId = Number(req.params.id);
    if (!Number.isInteger(cvId) || cvId <= 0) {
      throw new HttpError(400, 'Invalid CV ID.');
    }
    const cv = await getUserCVById(cvId, req.user.uid);
    if (!cv) {
      throw new HttpError(404, 'CV not found.');
    }

    const pdfBuffer = await generateATSCVPdfBuffer(cv.templateId, cv.data);
    const rawName = cv.data.personal.fullName || cv.title || 'NOVAAI-Resume';
    const safeFilename = `${rawName
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'Resume'}-ATS-CV.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdfBuffer.byteLength));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function exportInstantCVPdfHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = saveCVSchema.parse(req.body);
    const pdfBuffer = await generateATSCVPdfBuffer(parsed.templateId, parsed.data);
    const rawName = parsed.data.personal.fullName || parsed.title || 'NOVAAI-Resume';
    const safeFilename = `${rawName
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'Resume'}-ATS-CV.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdfBuffer.byteLength));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

