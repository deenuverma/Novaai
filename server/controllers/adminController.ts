import type { Response, NextFunction } from 'express';
import {
  deleteChatByAdmin,
  deleteCVByAdmin,
  deleteNoteByAdmin,
  deleteUserByAdmin,
  findUserByUid,
  getAdminOverviewStats,
  getChatWithMessagesAdmin,
  getUserFullActivityAdmin,
  listAllChatsAdmin,
  listAllCVsAdmin,
  listAllNotesAdmin,
  listAllUsersAdmin,
} from '../../src/db/repositories.ts';
import { isAdminEmail, type AuthRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/errorHandler.ts';

function parsePage(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function parseSearch(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, 120) : '';
}

export async function getAdminOverviewHandler(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const overview = await getAdminOverviewStats();
    res.json(overview);
  } catch (err) {
    next(err);
  }
}

export async function listAdminUsersHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const search = parseSearch(req.query.search);
    const page = parsePage(req.query.page);
    const data = await listAllUsersAdmin(search, page, 20);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAdminUserDetailHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const uid = String(req.params.uid || '').trim();
    if (!uid) {
      throw new HttpError(400, 'User UID is required.');
    }
    const detail = await getUserFullActivityAdmin(uid);
    if (!detail) {
      throw new HttpError(404, 'User account not found.');
    }
    res.json(detail);
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminUserHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const uid = String(req.params.uid || '').trim();
    if (!uid) {
      throw new HttpError(400, 'User UID is required.');
    }

    const target = await findUserByUid(uid);
    if (!target) {
      throw new HttpError(404, 'User account not found.');
    }

    if (isAdminEmail(target.email) || (req.user && req.user.uid === target.uid)) {
      throw new HttpError(
        400,
        'The primary administrator account cannot be deleted.'
      );
    }

    await deleteUserByAdmin(uid);
    res.json({ success: true, uid });
  } catch (err) {
    next(err);
  }
}

export async function listAdminNotesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const search = parseSearch(req.query.search);
    const page = parsePage(req.query.page);
    const data = await listAllNotesAdmin(search, page, 20);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminNoteHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId) || noteId <= 0) {
      throw new HttpError(400, 'Invalid note ID.');
    }
    const deleted = await deleteNoteByAdmin(noteId);
    if (!deleted) {
      throw new HttpError(404, 'Note not found.');
    }
    res.json({ success: true, id: noteId });
  } catch (err) {
    next(err);
  }
}

export async function listAdminChatsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const search = parseSearch(req.query.search);
    const page = parsePage(req.query.page);
    const data = await listAllChatsAdmin(search, page, 20);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAdminChatDetailHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const chatId = Number(req.params.id);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw new HttpError(400, 'Invalid chat ID.');
    }
    const chat = await getChatWithMessagesAdmin(chatId);
    if (!chat) {
      throw new HttpError(404, 'Conversation not found.');
    }
    res.json({ chat });
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminChatHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const chatId = Number(req.params.id);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw new HttpError(400, 'Invalid chat ID.');
    }
    const deleted = await deleteChatByAdmin(chatId);
    if (!deleted) {
      throw new HttpError(404, 'Conversation not found.');
    }
    res.json({ success: true, id: chatId });
  } catch (err) {
    next(err);
  }
}

export async function listAdminCVsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const search = parseSearch(req.query.search);
    const page = parsePage(req.query.page);
    const data = await listAllCVsAdmin(search, page, 20);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteAdminCVHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const cvId = Number(req.params.id);
    if (!Number.isInteger(cvId) || cvId <= 0) {
      throw new HttpError(400, 'Invalid CV ID.');
    }
    const deleted = await deleteCVByAdmin(cvId);
    if (!deleted) {
      throw new HttpError(404, 'CV record not found.');
    }
    res.json({ success: true, id: cvId });
  } catch (err) {
    next(err);
  }
}
