import { Router } from 'express';
import multer from 'multer';
import {
  deleteAdminChatHandler,
  deleteAdminCVHandler,
  deleteAdminNoteHandler,
  deleteAdminUserHandler,
  getAdminChatDetailHandler,
  getAdminOverviewHandler,
  getAdminUserDetailHandler,
  listAdminChatsHandler,
  listAdminCVsHandler,
  listAdminNotesHandler,
  listAdminUsersHandler,
} from '../controllers/adminController.ts';
import {
  firebaseSessionHandler,
  getMeHandler,
  googleAuthInfoHandler,
  googleCallbackHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  signupHandler,
  updateMeHandler,
  updatePasswordHandler,
  warmupAuthHandler,
} from '../controllers/authController.ts';
import {
  deleteChatHandler,
  getChatHandler,
  listChatsHandler,
  streamChatHandler,
  voiceConverseHandler,
  voiceTranscribeHandler,
  voiceTtsHandler,
  welcomeVoiceHandler,
} from '../controllers/chatController.ts';
import {
  createCVHandler,
  deleteCVHandler,
  downloadCVPdfHandler,
  exportInstantCVPdfHandler,
  getCVHandler,
  listCVsHandler,
  updateCVHandler,
} from '../controllers/cvController.ts';
import {
  createNoteHandler,
  deleteNoteHandler,
  downloadNoteHandler,
  getNoteDetailsHandler,
  listNotesHandler,
  previewNoteFileHandler,
} from '../controllers/notesController.ts';
import { requireAdmin, requireAuth } from '../middleware/auth.ts';
import { HttpError } from '../middleware/errorHandler.ts';
import { authRateLimiter, chatRateLimiter } from '../middleware/rateLimit.ts';

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.zip',
  '.json',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
  fileFilter: (_req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    const dotIndex = lower.lastIndexOf('.');
    const ext = dotIndex >= 0 ? lower.slice(dotIndex) : '';
    if (ext && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
      return;
    }
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('text/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype.includes('word') ||
      file.mimetype.includes('presentation') ||
      file.mimetype.includes('powerpoint') ||
      file.mimetype.includes('officedocument')
    ) {
      cb(null, true);
      return;
    }
    cb(
      new HttpError(
        400,
        'Unsupported file type. Upload PDF, DOC/DOCX, PPT/PPTX, images, TXT, Markdown, CSV, or ZIP.'
      )
    );
  },
});

export const apiRouter = Router();

// Auth Endpoints
apiRouter.get('/auth/warmup', warmupAuthHandler);
apiRouter.post('/auth/signup', authRateLimiter, signupHandler);
apiRouter.post('/auth/login', authRateLimiter, loginHandler);
apiRouter.post('/auth/firebase-session', authRateLimiter, firebaseSessionHandler);
apiRouter.post('/auth/refresh', refreshHandler);
apiRouter.post('/auth/logout', logoutHandler);
apiRouter.get('/auth/google', googleAuthInfoHandler);
apiRouter.get('/auth/google/callback', googleCallbackHandler);

// User Profile Endpoints
apiRouter.get('/users/me', requireAuth, getMeHandler);
apiRouter.put('/users/me', requireAuth, updateMeHandler);
apiRouter.put('/users/me/password', requireAuth, updatePasswordHandler);

// Exclusive Administrator Endpoints (deenuverma238@gmail.com only)
apiRouter.get('/admin/overview', requireAuth, requireAdmin, getAdminOverviewHandler);
apiRouter.get('/admin/users', requireAuth, requireAdmin, listAdminUsersHandler);
apiRouter.get('/admin/users/:uid', requireAuth, requireAdmin, getAdminUserDetailHandler);
apiRouter.delete('/admin/users/:uid', requireAuth, requireAdmin, deleteAdminUserHandler);
apiRouter.get('/admin/notes', requireAuth, requireAdmin, listAdminNotesHandler);
apiRouter.delete('/admin/notes/:id', requireAuth, requireAdmin, deleteAdminNoteHandler);
apiRouter.get('/admin/chats', requireAuth, requireAdmin, listAdminChatsHandler);
apiRouter.get('/admin/chats/:id', requireAuth, requireAdmin, getAdminChatDetailHandler);
apiRouter.delete('/admin/chats/:id', requireAuth, requireAdmin, deleteAdminChatHandler);
apiRouter.get('/admin/cvs', requireAuth, requireAdmin, listAdminCVsHandler);
apiRouter.delete('/admin/cvs/:id', requireAuth, requireAdmin, deleteAdminCVHandler);

// AI Chat & Live Human Voice Conversation Endpoints (strictly requires signup/login)
apiRouter.post('/chat', requireAuth, chatRateLimiter, streamChatHandler);
apiRouter.post('/chat/voice-converse', requireAuth, chatRateLimiter, voiceConverseHandler);
apiRouter.post('/chat/voice-transcribe', requireAuth, chatRateLimiter, voiceTranscribeHandler);
apiRouter.post('/chat/tts', requireAuth, chatRateLimiter, voiceTtsHandler);
apiRouter.post('/chat/welcome-voice', requireAuth, chatRateLimiter, welcomeVoiceHandler);
apiRouter.get('/chats', requireAuth, listChatsHandler);
apiRouter.get('/chats/:id', requireAuth, getChatHandler);
apiRouter.delete('/chats/:id', requireAuth, deleteChatHandler);

// Notes Library Endpoints (strictly requires signup/login)
apiRouter.get('/notes', requireAuth, listNotesHandler);
apiRouter.post(
  '/notes',
  requireAuth,
  upload.single('file'),
  createNoteHandler
);
apiRouter.get('/notes/:id', requireAuth, getNoteDetailsHandler);
apiRouter.get('/notes/:id/preview', requireAuth, previewNoteFileHandler);
apiRouter.get('/notes/:id/download', requireAuth, downloadNoteHandler);
apiRouter.delete('/notes/:id', requireAuth, deleteNoteHandler);

// ATS-Friendly CV Endpoints (strictly requires signup/login)
apiRouter.post('/cv/export-pdf', requireAuth, exportInstantCVPdfHandler);
apiRouter.post('/cv', requireAuth, createCVHandler);
apiRouter.get('/cv', requireAuth, listCVsHandler);
apiRouter.get('/cv/:id', requireAuth, getCVHandler);
apiRouter.put('/cv/:id', requireAuth, updateCVHandler);
apiRouter.delete('/cv/:id', requireAuth, deleteCVHandler);
apiRouter.get('/cv/:id/pdf', requireAuth, downloadCVPdfHandler);
