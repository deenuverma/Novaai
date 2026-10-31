# NOVAAI – AI Assistant, Notes Library & ATS CV Maker

**NOVAAI** is a full-stack multilingual study and career workspace created by **Deenu Verma**. It combines real-time streaming AI chat, a searchable academic notes library with inline document previews, and a single-column ATS-friendly PDF resume builder.

---

## Architecture Overview

```text
/
├── src/                      # Frontend application (React, TypeScript, Tailwind CSS, shadcn-style UI)
│   ├── components/           # Reusable UI primitives, AppShell, MarkdownRenderer, NotePreviewModal, CVPreview
│   ├── context/              # AuthContext (Google OAuth + JWT) & ThemeContext (Light/Dark mode)
│   ├── db/                   # PostgreSQL Drizzle ORM schema, config, connection pool & repositories
│   ├── hooks/                # useDebounce, useSpeech (Web Speech API voice input & TTS)
│   ├── pages/                # Landing, Auth, Chat, NotesLibrary, UploadNote, CVMaker, Profile
│   └── services/             # Typed API client & SSE stream consumer
├── server/                   # Express.js (TypeScript) REST API
│   ├── controllers/          # Auth, AI Chat (SSE), Notes Library (Multer 25MB), ATS CV & PDF export
│   ├── lib/                  # Firebase Admin verifier & JWT access/refresh cookie helpers
│   ├── middleware/           # Auth guard, rate limiters, centralized Zod/Multer error handler
│   ├── routes/               # Express API router (/api/*)
│   ├── services/             # Server-side AI streaming & PDFKit selectable-text ATS PDF engine
│   ├── validators/           # Zod request schemas
│   └── seed.ts               # Sample data seeder
├── client/                   # Client deployment env template
└── server.ts                 # Unified Express + Vite / static production entry on Port 3000
```

---

## Core Features

1. **Multilingual Streaming AI Chat (`/chat`)**
   - Live token-by-token responses over **Server-Sent Events (SSE)**.
   - Automatic language detection (Hindi, Hinglish, English, Spanish, French, German, Arabic, Bengali, Tamil, Japanese, and more) plus a manual language override selector.
   - Enforces NOVAAI creator attribution (**Deenu Verma**) in every language via the backend system prompt.
   - **Web Speech API** microphone dictation and browser **Text-to-Speech** audio playback.
   - Markdown tables and syntax-labeled code blocks with one-click copy.
   - Persistent chat history saved in PostgreSQL with create and delete support.

2. **Academic Notes Library (`/notes` & `/notes/upload`)**
   - Upload PDF, DOC/DOCX, PPT/PPTX, PNG/JPG/WEBP, TXT, Markdown, CSV, or ZIP files up to **25 MB**.
   - Debounced full-text `ILIKE` search across title, subject, class/semester, and tags with highlighted search matches.
   - Filter by subject and semester, sort by newest or most downloaded, preview inline in a modal, and track verified download counts.

3. **ATS-Friendly CV Maker (`/cv`)**
   - 7-step structured editor: Personal Details, Summary, Education, Skills, Experience, Projects, and Certifications.
   - 3 single-column ATS-compliant templates (`Executive Sans`, `Classic Serif`, `Technical Compact`) using standard fonts, semantic headings, and zero parser-breaking tables or graphics.
   - Side-by-side live preview on desktop and dedicated Form / Preview tabs on mobile.
   - Server-side PDF export (`GET /api/cv/:id/pdf` and `POST /api/cv/export-pdf`) producing selectable-text A4 PDFs.

4. **Responsive Multi-Device Layout & Dark/Light Mode**
   - **Mobile (`<768px`)**: Fixed bottom navigation (`Chat`, `Notes`, `CV`, `Profile`), full-screen chat, single-column grids, and tabbed CV form/preview.
   - **Tablet (`768px–1023px`)**: Compact sidebar rail and 2-column grids.
   - **Desktop (`>=1024px`)**: Persistent left sidebar, docked chat history, side-by-side CV editor + preview, and 3–4 column notes grid.

---

## Local Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and populate your PostgreSQL (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`) and JWT secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).

### 3. Push PostgreSQL Schema & Seed Sample Data

```bash
npx drizzle-kit push --config=src/db/drizzle.config.ts
npm run seed
```

### 4. Start Development Server

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## REST API Summary

- **Auth & Profile**: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/google`, `GET /api/users/me`, `PUT /api/users/me`
- **AI Chat**: `POST /api/chat` (SSE), `GET /api/chats`, `GET /api/chats/:id`, `DELETE /api/chats/:id`
- **Notes**: `GET /api/notes`, `POST /api/notes`, `GET /api/notes/:id`, `GET /api/notes/:id/preview`, `GET /api/notes/:id/download`, `DELETE /api/notes/:id`
- **CV Maker**: `GET /api/cv`, `POST /api/cv`, `GET /api/cv/:id`, `PUT /api/cv/:id`, `DELETE /api/cv/:id`, `GET /api/cv/:id/pdf`

---

## Production Build & Deployment

1. Build the frontend bundle:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm start
   ```
   - **Unified Cloud Run / Railway / Render**: Deploy the root repository with build command `npm run build` and start command `npm start`.
   - **Split Frontend & Backend**: Deploy the static `dist/` frontend to Vercel (pointing `/api/*` rewrites to your Express backend URL) and run `node server.ts` on Render or Railway connected to managed PostgreSQL.
