import type { Request, Response, NextFunction } from 'express';
import {
  createNoteRecord,
  deleteNoteByOwner,
  getNoteById,
  getOrCreateOAuthUser,
  incrementNoteDownloads,
  listNotesQuery,
} from '../../src/db/repositories.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/errorHandler.ts';
import { generateStudyNotePdfBuffer } from '../services/pdfService.ts';
import { createNoteMetadataSchema } from '../validators/schemas.ts';

let seedingInProgress: Promise<void> | null = null;
let seededChecked = false;

async function ensureSampleNotesSeeded() {
  if (seededChecked) return;
  if (seedingInProgress) {
    await seedingInProgress;
    return;
  }

  seedingInProgress = (async () => {
    try {
      const initial = await listNotesQuery({ page: 1, limit: 1 });
      if (initial.pagination.total > 0) {
        seededChecked = true;
        return;
      }

      const systemAuthor = await getOrCreateOAuthUser({
        uid: 'novaai_faculty_curator',
        email: 'curator@novaai.edu',
        name: 'Aarav Kulkarni',
        googleId: null,
      });

      const secondAuthor = await getOrCreateOAuthUser({
        uid: 'novaai_cs_fellow',
        email: 'ananya.rao@novaai.edu',
        name: 'Ananya Rao',
        googleId: null,
      });

      const dsaPdf = await generateStudyNotePdfBuffer({
        title: 'Graph Algorithms, Shortest Paths & Dynamic Programming',
        subject: 'Computer Science',
        classLevel: 'Semester 5',
        author: 'Ananya Rao',
        sections: [
          {
            heading: '1. Breadth-First & Depth-First Search Foundations',
            body: 'BFS explores vertices in concentric layers using a FIFO queue in O(V + E) time, guaranteeing shortest unweighted paths. DFS explores along branches using recursion or an explicit stack, enabling cycle detection, topological ordering, and strongly connected component decomposition (Kosaraju and Tarjan algorithms).',
          },
          {
            heading: '2. Weighted Shortest Paths: Dijkstra vs Bellman-Ford',
            body: 'Dijkstra maintains a min-priority queue of tentative distances and requires non-negative edge weights, achieving O((V + E) log V) with a binary heap. Bellman-Ford relaxes all edges V - 1 times in O(VE), handling negative weights and detecting negative-weight cycles on the V-th pass.',
          },
          {
            heading: '3. Dynamic Programming State Formulation',
            body: 'Every DP solution defines: (a) Subproblem state variables, (b) Recurrence relation over optimal substructures, (c) Base cases, and (d) Evaluation topological order or memoization table. Classic patterns: 0/1 Knapsack, Longest Increasing Subsequence O(n log n), and Matrix Chain Multiplication.',
          },
        ],
      });

      const dbmsPdf = await generateStudyNotePdfBuffer({
        title: 'PostgreSQL Indexing, MVCC Concurrency & Normalization',
        subject: 'Database Systems',
        classLevel: 'Semester 4',
        author: 'Aarav Kulkarni',
        sections: [
          {
            heading: '1. Normal Forms (1NF through BCNF)',
            body: 'Normalization eliminates update, insertion, and deletion anomalies. Third Normal Form (3NF) removes transitive dependencies on candidate keys; Boyce-Codd Normal Form (BCNF) ensures every non-trivial functional dependency X -> Y has X as a superkey.',
          },
          {
            heading: '2. B-Tree vs GIN Full-Text Indexes in PostgreSQL',
            body: 'B-Tree indexes accelerate equality and range predicates (=, <, <=, BETWEEN, prefix LIKE). Generalized Inverted Indexes (GIN) index composite values such as tsvector tokens and text[] tag arrays for fast full-text lookup.',
          },
          {
            heading: '3. Multi-Version Concurrency Control (MVCC)',
            body: 'Readers never block writers and writers never block readers. Each transaction observes a consistent snapshot determined by xmin and xmax tuple transaction IDs, preventing dirty reads and lost updates under Read Committed and Serializable isolation.',
          },
        ],
      });

      const mlPdf = await generateStudyNotePdfBuffer({
        title: 'Transformer Attention Mechanics & Backpropagation Calculus',
        subject: 'Machine Learning',
        classLevel: 'Semester 6',
        author: 'Ananya Rao',
        sections: [
          {
            heading: '1. Scaled Dot-Product Attention',
            body: 'Given query Q, key K, and value V projections of dimension d_k, Attention(Q, K, V) = softmax((Q K^T) / sqrt(d_k)) V. Scaling by 1 / sqrt(d_k) prevents large dot products from pushing softmax into vanishing-gradient saturation.',
          },
          {
            heading: '2. Residual Connections & Layer Normalization',
            body: 'Pre-LayerNorm stabilizes deep gradient propagation across multi-head attention and feed-forward blocks without warm-up instabilities, enabling fast convergence across sequence modeling tasks.',
          },
        ],
      });

      const osMarkdown = `# Operating Systems: Virtual Memory & Page Replacement

## 1. Demand Paging & Translation Lookaside Buffer (TLB)
- Virtual addresses split into **Virtual Page Number (VPN)** and **Offset**.
- Effective Access Time (EAT): \`EAT = hit_ratio * (TLB + mem) + (1 - hit_ratio) * (TLB + 2 * mem)\`.

## 2. Page Replacement Policies
1. **Optimal (Belady)**: Evicts the page unused for the longest future duration (theoretical benchmark).
2. **LRU (Least Recently Used)**: Approximated in hardware using reference bits / Clock second-chance algorithm.
3. **Working Set Model**: Prevents thrashing by tracking active pages within window \`Delta\`.

## 3. Process Synchronization Primitives
- **Mutex Locks** vs **Counting Semaphores**
- Deadlock necessary conditions (Coffman): Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait.
`;

      const calcNotes = `LINEAR ALGEBRA & MULTIVARIABLE CALCULUS QUICK SHEET
====================================================

1. Eigenvalues & Spectral Theorem
   - Characteristic polynomial: det(A - lambda * I) = 0
   - Any real symmetric matrix A = Q * Lambda * Q^T has real eigenvalues and orthogonal eigenvectors.

2. Singular Value Decomposition (SVD)
   - Every m x n matrix factors as A = U * Sigma * V^T.
   - Low-rank approximation (Eckart-Young theorem): truncate to top-k singular values.

3. Gradient, Jacobian & Hessian
   - Directional derivative along unit vector u: D_u f(x) = grad f(x) . u
   - Second-order optimality: grad f(x*) = 0 and Hessian H(x*) positive definite => strict local minimum.
`;

      const samples = [
        {
          userId: secondAuthor.uid,
          uploaderName: secondAuthor.name,
          title: 'Graph Algorithms, Shortest Paths & Dynamic Programming',
          subject: 'Computer Science',
          classLevel: 'Semester 5',
          tags: ['algorithms', 'graphs', 'dijkstra', 'dynamic-programming'],
          fileName: 'graph-algorithms-dp-notes.pdf',
          fileType: 'application/pdf',
          buffer: dsaPdf,
          downloads: 184,
        },
        {
          userId: systemAuthor.uid,
          uploaderName: systemAuthor.name,
          title: 'PostgreSQL Indexing, MVCC Concurrency & Normalization',
          subject: 'Database Systems',
          classLevel: 'Semester 4',
          tags: ['postgresql', 'sql', 'bcnf', 'indexing', 'mvcc'],
          fileName: 'postgresql-mvcc-normalization.pdf',
          fileType: 'application/pdf',
          buffer: dbmsPdf,
          downloads: 142,
        },
        {
          userId: secondAuthor.uid,
          uploaderName: secondAuthor.name,
          title: 'Transformer Attention Mechanics & Backpropagation Calculus',
          subject: 'Machine Learning',
          classLevel: 'Semester 6',
          tags: ['transformers', 'deep-learning', 'attention', 'neural-networks'],
          fileName: 'transformer-attention-notes.pdf',
          fileType: 'application/pdf',
          buffer: mlPdf,
          downloads: 219,
        },
        {
          userId: systemAuthor.uid,
          uploaderName: systemAuthor.name,
          title: 'Operating Systems: Virtual Memory, TLB & Deadlock Prevention',
          subject: 'Operating Systems',
          classLevel: 'Semester 4',
          tags: ['operating-systems', 'virtual-memory', 'lru', 'concurrency'],
          fileName: 'os-virtual-memory-guide.md',
          fileType: 'text/markdown',
          buffer: Buffer.from(osMarkdown, 'utf-8'),
          downloads: 96,
        },
        {
          userId: systemAuthor.uid,
          uploaderName: systemAuthor.name,
          title: 'Linear Algebra, SVD & Multivariable Optimization Reference',
          subject: 'Mathematics',
          classLevel: 'Semester 3',
          tags: ['linear-algebra', 'svd', 'eigenvalues', 'calculus'],
          fileName: 'linear-algebra-svd-sheet.txt',
          fileType: 'text/plain',
          buffer: Buffer.from(calcNotes, 'utf-8'),
          downloads: 128,
        },
      ];

      for (const s of samples) {
        const created = await createNoteRecord({
          userId: s.userId,
          uploaderName: s.uploaderName,
          title: s.title,
          subject: s.subject,
          classLevel: s.classLevel,
          tags: s.tags,
          fileUrl: '/api/notes/pending/preview',
          fileName: s.fileName,
          fileType: s.fileType,
          fileSize: s.buffer.byteLength,
          fileData: s.buffer.toString('base64'),
        });
        // Set initial download count & accurate preview URL via direct Drizzle update in repository if needed
        // Note: preview endpoint uses /api/notes/:id/preview dynamically by ID!
        void created;
      }

      seededChecked = true;
    } catch (err) {
      console.error('Non-fatal sample note seed check error:', err);
    } finally {
      seedingInProgress = null;
    }
  })();

  await seedingInProgress;
}

function extractSearchableContent(
  file: Express.Multer.File,
  userSummary: string
): string {
  const parts: string[] = [];
  if (userSummary && userSummary.trim()) {
    parts.push(userSummary.trim());
  }

  const lowerName = file.originalname.toLowerCase();
  const isPlainText =
    file.mimetype.startsWith('text/') ||
    /\.(txt|md|csv|json)$/i.test(lowerName);

  if (isPlainText) {
    const decoded = file.buffer
      .toString('utf-8')
      .replace(/\0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 35000);
    if (decoded) parts.push(decoded);
  } else {
    // Extract readable ASCII phrase runs from PDF/Office buffers without external binaries
    const rawLatin = file.buffer.toString('latin1');
    const matches = rawLatin.match(/[A-Za-z][A-Za-z0-9 ,.;:()\-_/]{4,}/g) || [];
    const pdfSyntaxNoise =
      /^(obj|endobj|stream|endstream|xref|trailer|startxref|Type|Font|Page|Parent|Resources|MediaBox|Length|Filter|FlateDecode)$/i;
    const filtered = matches
      .map((s) => s.trim())
      .filter((s) => s.length >= 5 && !pdfSyntaxNoise.test(s))
      .slice(0, 400);
    if (filtered.length > 0) {
      parts.push(filtered.join(' ').slice(0, 15000));
    }
  }

  return parts.join('\n').trim();
}

export async function createNoteHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required to upload notes.');
    }

    const file = req.file;
    if (!file) {
      throw new HttpError(400, 'Please attach a file to upload (maximum 25MB).');
    }

    if (file.size > 25 * 1024 * 1024) {
      throw new HttpError(413, 'File exceeds the 25MB size limit.');
    }

    const parsed = createNoteMetadataSchema.parse(req.body);
    const parsedTags = parsed.tags
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/^#+/, ''))
      .filter((t) => t.length > 0)
      .slice(0, 12);

    const base64Data = file.buffer.toString('base64');
    const safeMime = file.mimetype || 'application/octet-stream';
    const contentText = extractSearchableContent(file, parsed.contentSummary);

    const created = await createNoteRecord({
      userId: req.user.uid,
      uploaderName: req.user.name,
      title: parsed.title,
      subject: parsed.subject,
      classLevel: parsed.classLevel,
      tags: parsedTags,
      contentText,
      fileUrl: `/api/notes/file/${encodeURIComponent(file.originalname)}`,
      fileName: file.originalname,
      fileType: safeMime,
      fileSize: file.size,
      fileData: base64Data,
    });

    res.status(201).json({
      note: {
        ...created,
        fileUrl: `/api/notes/${created.id}/preview`,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listNotesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    await ensureSampleNotesSeeded();

    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const rawField =
      typeof req.query.field === 'string' ? req.query.field : 'all';
    const searchField =
      rawField === 'title' || rawField === 'subject' || rawField === 'content'
        ? rawField
        : ('all' as const);
    const subject = typeof req.query.subject === 'string' ? req.query.subject : '';
    const classLevel =
      typeof req.query.class === 'string' ? req.query.class : '';
    const mineOnly = req.query.mine === 'true';
    const sort =
      req.query.sort === 'downloads' ? 'downloads' : ('newest' as const);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));

    if (mineOnly && !req.user) {
      res.json({
        items: [],
        pagination: { page: 1, limit, total: 0, totalPages: 1 },
      });
      return;
    }

    const result = await listNotesQuery({
      search,
      searchField,
      subject,
      classLevel,
      userId: mineOnly && req.user ? req.user.uid : undefined,
      sort,
      page,
      limit,
    });

    const items = result.items.map((item) => ({
      ...item,
      fileUrl: `/api/notes/${item.id}/preview`,
    }));

    res.json({
      items,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getNoteDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId) || noteId <= 0) {
      throw new HttpError(400, 'Invalid note ID.');
    }

    const note = await getNoteById(noteId, false);
    if (!note) {
      throw new HttpError(404, 'Note not found.');
    }

    res.json({
      note: {
        ...note,
        fileUrl: `/api/notes/${note.id}/preview`,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function previewNoteFileHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId) || noteId <= 0) {
      throw new HttpError(400, 'Invalid note ID.');
    }

    const note = await getNoteById(noteId, true);
    if (
      !note ||
      !('fileData' in note) ||
      typeof note.fileData !== 'string' ||
      !note.fileData
    ) {
      throw new HttpError(404, 'Note file content not found.');
    }

    const fileBuffer = Buffer.from(note.fileData, 'base64');
    const safeName = (note.fileName || `note-${note.id}`).replace(/["\r\n]/g, '');

    res.setHeader('Content-Type', note.fileType || 'application/octet-stream');
    res.setHeader('Content-Length', String(fileBuffer.byteLength));
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.send(fileBuffer);
  } catch (err) {
    next(err);
  }
}

export async function downloadNoteHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId) || noteId <= 0) {
      throw new HttpError(400, 'Invalid note ID.');
    }

    const updated = await incrementNoteDownloads(noteId);
    if (!updated || !updated.fileData) {
      throw new HttpError(404, 'Note file not found.');
    }

    const fileBuffer = Buffer.from(updated.fileData, 'base64');
    const safeName = (updated.fileName || `note-${updated.id}`).replace(
      /["\r\n]/g,
      ''
    );

    res.setHeader('Content-Type', updated.fileType || 'application/octet-stream');
    res.setHeader('Content-Length', String(fileBuffer.byteLength));
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Note-Downloads', String(updated.downloads));
    res.send(fileBuffer);
  } catch (err) {
    next(err);
  }
}

export async function deleteNoteHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required.');
    }

    const noteId = Number(req.params.id);
    if (!Number.isInteger(noteId) || noteId <= 0) {
      throw new HttpError(400, 'Invalid note ID.');
    }

    const outcome = await deleteNoteByOwner(noteId, req.user.uid);
    if (outcome.status === 'not_found') {
      throw new HttpError(404, 'Note not found.');
    }
    if (outcome.status === 'forbidden') {
      throw new HttpError(403, 'You can only delete notes that you uploaded.');
    }

    res.json({ success: true, id: noteId });
  } catch (err) {
    next(err);
  }
}
