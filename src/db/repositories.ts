import { and, count, desc, eq, ilike, isNotNull, or, sql, sum } from 'drizzle-orm';
import { db } from './index.ts';
import {
  chats,
  cvs,
  messages,
  notes,
  users,
  type CVDocumentData,
} from './schema.ts';

export async function getOrCreateOAuthUser(params: {
  uid: string;
  email: string;
  name: string;
  avatar?: string | null;
  googleId?: string | null;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  try {
    // 1. Check if a user with this email already exists (e.g., created via Email/Password first)
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail[0]) {
      const current = existingByEmail[0];
      const nextGoogleId = params.googleId ?? params.uid;
      const nextAvatar = current.avatar || params.avatar || null;
      if (current.googleId !== nextGoogleId || current.avatar !== nextAvatar) {
        const updated = await db
          .update(users)
          .set({
            googleId: nextGoogleId,
            avatar: nextAvatar,
          })
          .where(eq(users.id, current.id))
          .returning();
        if (updated[0]) return updated[0];
      }
      return current;
    }

    // 2. Otherwise upsert by Firebase UID
    const result = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: normalizedEmail,
        name: params.name || normalizedEmail.split('@')[0] || 'NOVAAI User',
        avatar: params.avatar ?? null,
        googleId: params.googleId ?? params.uid,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          googleId: params.googleId ?? params.uid,
          ...(params.avatar ? { avatar: params.avatar } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateOAuthUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function findUserByEmail(email: string) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findUserByEmail:', error);
    throw new Error('Failed to look up user account.', { cause: error });
  }
}

export async function findUserByUid(uid: string) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findUserByUid:', error);
    throw new Error('Failed to load user profile.', { cause: error });
  }
}

export async function createPasswordUser(params: {
  uid: string;
  name: string;
  email: string;
  passwordHash: string;
}) {
  try {
    const rows = await db
      .insert(users)
      .values({
        uid: params.uid,
        name: params.name,
        email: params.email.toLowerCase(),
        passwordHash: params.passwordHash,
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in createPasswordUser:', error);
    throw new Error('Failed to create user account.', { cause: error });
  }
}

export async function updateUserProfile(
  uid: string,
  updates: { name?: string; avatar?: string | null }
) {
  try {
    const rows = await db
      .update(users)
      .set(updates)
      .where(eq(users.uid, uid))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateUserProfile:', error);
    throw new Error('Failed to update user profile.', { cause: error });
  }
}

export async function updateUserPasswordHash(uid: string, passwordHash: string) {
  try {
    const rows = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.uid, uid))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateUserPasswordHash:', error);
    throw new Error('Failed to update account password.', { cause: error });
  }
}

export async function findUserByEmailWithStats(email: string) {
  try {
    const normalized = email.trim().toLowerCase();
    const rows = await db
      .select({
        user: users,
        chatsCount: sql<number>`(select count(*)::int from chats where chats.user_id = ${users.uid})`,
        notesCount: sql<number>`(select count(*)::int from notes where notes.user_id = ${users.uid})`,
        cvsCount: sql<number>`(select count(*)::int from cvs where cvs.user_id = ${users.uid})`,
      })
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);

    if (!rows[0]) return null;
    return {
      user: rows[0].user,
      stats: {
        chats: Number(rows[0].chatsCount ?? 0),
        notes: Number(rows[0].notesCount ?? 0),
        cvs: Number(rows[0].cvsCount ?? 0),
      },
    };
  } catch (error) {
    console.error('Database query failed in findUserByEmailWithStats:', error);
    throw new Error('Failed to look up user account.', { cause: error });
  }
}

export async function getUserStats(uid: string) {
  try {
    const result = await db.execute<{
      chats: number;
      notes: number;
      cvs: number;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM chats WHERE user_id = ${uid}) AS chats,
        (SELECT count(*)::int FROM notes WHERE user_id = ${uid}) AS notes,
        (SELECT count(*)::int FROM cvs WHERE user_id = ${uid}) AS cvs
    `);
    const row = result.rows?.[0];
    return {
      chats: Number(row?.chats ?? 0),
      notes: Number(row?.notes ?? 0),
      cvs: Number(row?.cvs ?? 0),
    };
  } catch (error) {
    console.error('Database query failed in getUserStats:', error);
    throw new Error('Failed to load account statistics.', { cause: error });
  }
}

// ---------------- CHATS & MESSAGES ----------------

export async function createChatRecord(userId: string, title: string) {
  try {
    const rows = await db
      .insert(chats)
      .values({ userId, title })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in createChatRecord:', error);
    throw new Error('Failed to create chat session.', { cause: error });
  }
}

export async function updateChatTitle(chatId: number, userId: string, title: string) {
  try {
    const rows = await db
      .update(chats)
      .set({ title })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateChatTitle:', error);
    throw new Error('Failed to update chat title.', { cause: error });
  }
}

export async function listUserChats(userId: string, page = 1, limit = 30) {
  try {
    const offset = (page - 1) * limit;
    const [totalRow] = await db
      .select({ value: count() })
      .from(chats)
      .where(eq(chats.userId, userId));

    const items = await db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.createdAt))
      .limit(limit)
      .offset(offset);

    const total = Number(totalRow?.value ?? 0);
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  } catch (error) {
    console.error('Database query failed in listUserChats:', error);
    throw new Error('Failed to load chat history.', { cause: error });
  }
}

export async function getChatWithMessages(chatId: number, userId: string) {
  try {
    const chatRows = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .limit(1);

    if (!chatRows[0]) return null;

    const msgRows = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt, messages.id);

    return {
      ...chatRows[0],
      messages: msgRows,
    };
  } catch (error) {
    console.error('Database query failed in getChatWithMessages:', error);
    throw new Error('Failed to load conversation messages.', { cause: error });
  }
}

export async function insertChatMessage(params: {
  chatId: number;
  role: 'user' | 'assistant';
  content: string;
  language: string;
}) {
  try {
    const rows = await db
      .insert(messages)
      .values({
        chatId: params.chatId,
        role: params.role,
        content: params.content,
        language: params.language,
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in insertChatMessage:', error);
    throw new Error('Failed to save chat message.', { cause: error });
  }
}

export async function deleteUserChat(chatId: number, userId: string) {
  try {
    const rows = await db
      .delete(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in deleteUserChat:', error);
    throw new Error('Failed to delete chat.', { cause: error });
  }
}

// ---------------- NOTES LIBRARY ----------------

export async function createNoteRecord(params: {
  userId: string;
  uploaderName: string;
  title: string;
  subject: string;
  classLevel: string;
  tags: string[];
  contentText?: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string | null;
}) {
  try {
    const rows = await db
      .insert(notes)
      .values({
        userId: params.userId,
        uploaderName: params.uploaderName,
        title: params.title,
        subject: params.subject,
        classLevel: params.classLevel,
        tags: params.tags,
        tagsText: params.tags.join(' '),
        contentText: params.contentText ?? '',
        fileUrl: params.fileUrl,
        fileName: params.fileName,
        fileType: params.fileType,
        fileSize: params.fileSize,
        fileData: params.fileData,
      })
      .returning();
    const { fileData: _omit, ...rest } = rows[0];
    return rest;
  } catch (error) {
    console.error('Database query failed in createNoteRecord:', error);
    throw new Error('Failed to save uploaded note.', { cause: error });
  }
}

export async function listNotesQuery(params: {
  search?: string;
  searchField?: 'all' | 'title' | 'subject' | 'content';
  subject?: string;
  classLevel?: string;
  userId?: string;
  sort?: 'newest' | 'downloads';
  page?: number;
  limit?: number;
}) {
  try {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 12));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (params.userId && params.userId.trim().length > 0) {
      conditions.push(eq(notes.userId, params.userId.trim()));
    }

    if (params.search && params.search.trim().length > 0) {
      const pattern = `%${params.search.trim()}%`;
      const field = params.searchField ?? 'all';

      if (field === 'title') {
        conditions.push(ilike(notes.title, pattern));
      } else if (field === 'subject') {
        conditions.push(ilike(notes.subject, pattern));
      } else if (field === 'content') {
        conditions.push(
          or(ilike(notes.contentText, pattern), ilike(notes.tagsText, pattern))
        );
      } else {
        conditions.push(
          or(
            ilike(notes.title, pattern),
            ilike(notes.subject, pattern),
            ilike(notes.contentText, pattern),
            ilike(notes.tagsText, pattern),
            ilike(notes.classLevel, pattern)
          )
        );
      }
    }

    if (params.subject && params.subject !== 'All') {
      conditions.push(eq(notes.subject, params.subject));
    }

    if (params.classLevel && params.classLevel !== 'All') {
      conditions.push(eq(notes.classLevel, params.classLevel));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ value: count() })
      .from(notes)
      .where(whereClause);

    const rows = await db
      .select({
        id: notes.id,
        userId: notes.userId,
        uploaderName: notes.uploaderName,
        title: notes.title,
        subject: notes.subject,
        classLevel: notes.classLevel,
        tags: notes.tags,
        contentText: notes.contentText,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        fileType: notes.fileType,
        fileSize: notes.fileSize,
        downloads: notes.downloads,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(whereClause)
      .orderBy(
        params.sort === 'downloads'
          ? desc(notes.downloads)
          : desc(notes.createdAt),
        desc(notes.id)
      )
      .limit(limit)
      .offset(offset);

    const total = Number(totalRow?.value ?? 0);

    return {
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  } catch (error) {
    console.error('Database query failed in listNotesQuery:', error);
    throw new Error('Failed to fetch notes library.', { cause: error });
  }
}

export async function getNoteById(noteId: number, includeFileData = false) {
  try {
    if (includeFileData) {
      const rows = await db
        .select()
        .from(notes)
        .where(eq(notes.id, noteId))
        .limit(1);
      return rows[0] ?? null;
    }

    const rows = await db
      .select({
        id: notes.id,
        userId: notes.userId,
        uploaderName: notes.uploaderName,
        title: notes.title,
        subject: notes.subject,
        classLevel: notes.classLevel,
        tags: notes.tags,
        contentText: notes.contentText,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        fileType: notes.fileType,
        fileSize: notes.fileSize,
        downloads: notes.downloads,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getNoteById:', error);
    throw new Error('Failed to load note details.', { cause: error });
  }
}

export async function incrementNoteDownloads(noteId: number) {
  try {
    const rows = await db
      .update(notes)
      .set({
        downloads: sql`${notes.downloads} + 1`,
      })
      .where(eq(notes.id, noteId))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in incrementNoteDownloads:', error);
    throw new Error('Failed to process note download.', { cause: error });
  }
}

export async function deleteNoteByOwner(noteId: number, userId: string) {
  try {
    const existing = await db
      .select({ id: notes.id, userId: notes.userId })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!existing[0]) {
      return { status: 'not_found' as const };
    }
    if (existing[0].userId !== userId) {
      return { status: 'forbidden' as const };
    }

    await db.delete(notes).where(eq(notes.id, noteId));
    return { status: 'deleted' as const };
  } catch (error) {
    console.error('Database query failed in deleteNoteByOwner:', error);
    throw new Error('Failed to delete note.', { cause: error });
  }
}

// ---------------- ATS CV MAKER ----------------

export async function createCVRecord(params: {
  userId: string;
  title: string;
  templateId: string;
  data: CVDocumentData;
}) {
  try {
    const rows = await db
      .insert(cvs)
      .values({
        userId: params.userId,
        title: params.title,
        templateId: params.templateId,
        data: params.data,
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in createCVRecord:', error);
    throw new Error('Failed to save CV.', { cause: error });
  }
}

export async function listUserCVs(userId: string, page = 1, limit = 20) {
  try {
    const offset = (page - 1) * limit;
    const [totalRow] = await db
      .select({ value: count() })
      .from(cvs)
      .where(eq(cvs.userId, userId));

    const items = await db
      .select()
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.updatedAt), desc(cvs.id))
      .limit(limit)
      .offset(offset);

    const total = Number(totalRow?.value ?? 0);
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  } catch (error) {
    console.error('Database query failed in listUserCVs:', error);
    throw new Error('Failed to load saved CVs.', { cause: error });
  }
}

export async function getUserCVById(cvId: number, userId: string) {
  try {
    const rows = await db
      .select()
      .from(cvs)
      .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getUserCVById:', error);
    throw new Error('Failed to fetch CV document.', { cause: error });
  }
}

export async function updateUserCV(
  cvId: number,
  userId: string,
  updates: {
    title?: string;
    templateId?: string;
    data?: CVDocumentData;
  }
) {
  try {
    const rows = await db
      .update(cvs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateUserCV:', error);
    throw new Error('Failed to update CV.', { cause: error });
  }
}

export async function deleteUserCV(cvId: number, userId: string) {
  try {
    const rows = await db
      .delete(cvs)
      .where(and(eq(cvs.id, cvId), eq(cvs.userId, userId)))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in deleteUserCV:', error);
    throw new Error('Failed to delete CV.', { cause: error });
  }
}

// ---------------- ADMINISTRATOR DASHBOARD QUERIES ----------------

export async function getAdminOverviewStats() {
  try {
    const [
      [userTotalRow],
      [googleUsersRow],
      [passwordUsersRow],
      [chatTotalRow],
      [messageTotalRow],
      [noteStatsRow],
      [cvTotalRow],
      recentUsers,
      topNotes,
    ] = await Promise.all([
      db.select({ value: count() }).from(users),
      db
        .select({ value: count() })
        .from(users)
        .where(isNotNull(users.googleId)),
      db
        .select({ value: count() })
        .from(users)
        .where(isNotNull(users.passwordHash)),
      db.select({ value: count() }).from(chats),
      db.select({ value: count() }).from(messages),
      db
        .select({
          totalNotes: count(),
          totalDownloads: sum(notes.downloads),
          totalStorageBytes: sum(notes.fileSize),
        })
        .from(notes),
      db.select({ value: count() }).from(cvs),
      db
        .select({
          id: users.id,
          uid: users.uid,
          name: users.name,
          email: users.email,
          avatar: users.avatar,
          googleId: users.googleId,
          passwordHash: users.passwordHash,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(6),
      db
        .select({
          id: notes.id,
          title: notes.title,
          subject: notes.subject,
          classLevel: notes.classLevel,
          uploaderName: notes.uploaderName,
          fileSize: notes.fileSize,
          downloads: notes.downloads,
          createdAt: notes.createdAt,
        })
        .from(notes)
        .orderBy(desc(notes.downloads), desc(notes.id))
        .limit(5),
    ]);

    return {
      totals: {
        users: Number(userTotalRow?.value ?? 0),
        googleUsers: Number(googleUsersRow?.value ?? 0),
        passwordUsers: Number(passwordUsersRow?.value ?? 0),
        chats: Number(chatTotalRow?.value ?? 0),
        messages: Number(messageTotalRow?.value ?? 0),
        notes: Number(noteStatsRow?.totalNotes ?? 0),
        noteDownloads: Number(noteStatsRow?.totalDownloads ?? 0),
        noteStorageBytes: Number(noteStatsRow?.totalStorageBytes ?? 0),
        cvs: Number(cvTotalRow?.value ?? 0),
      },
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        uid: u.uid,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        authProvider:
          u.googleId && u.passwordHash
            ? ('both' as const)
            : u.googleId
              ? ('google' as const)
              : ('password' as const),
        createdAt: u.createdAt,
      })),
      topNotes,
    };
  } catch (error) {
    console.error('Database query failed in getAdminOverviewStats:', error);
    throw new Error('Failed to load administrator overview.', { cause: error });
  }
}

export async function listAllUsersAdmin(search = '', page = 1, limit = 20) {
  try {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const trimmed = search.trim();
    const whereClause = trimmed
      ? or(
          ilike(users.name, `%${trimmed}%`),
          ilike(users.email, `%${trimmed}%`),
          ilike(users.uid, `%${trimmed}%`)
        )
      : undefined;

    const [totalRow] = await db
      .select({ value: count() })
      .from(users)
      .where(whereClause);

    const userRows = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(safeLimit)
      .offset(offset);

    const enriched = await Promise.all(
      userRows.map(async (u) => {
        const stats = await getUserStats(u.uid);
        return {
          id: u.id,
          uid: u.uid,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          authProvider:
            u.googleId && u.passwordHash
              ? ('both' as const)
              : u.googleId
                ? ('google' as const)
                : ('password' as const),
          createdAt: u.createdAt,
          chatsCount: stats.chats,
          notesCount: stats.notes,
          cvsCount: stats.cvs,
        };
      })
    );

    const total = Number(totalRow?.value ?? 0);
    return {
      items: enriched,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  } catch (error) {
    console.error('Database query failed in listAllUsersAdmin:', error);
    throw new Error('Failed to list platform users.', { cause: error });
  }
}

export async function deleteUserByAdmin(uid: string) {
  try {
    const rows = await db
      .delete(users)
      .where(eq(users.uid, uid))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in deleteUserByAdmin:', error);
    throw new Error('Failed to delete user account.', { cause: error });
  }
}

export async function listAllNotesAdmin(search = '', page = 1, limit = 20) {
  try {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const trimmed = search.trim();
    const whereClause = trimmed
      ? or(
          ilike(notes.title, `%${trimmed}%`),
          ilike(notes.subject, `%${trimmed}%`),
          ilike(notes.uploaderName, `%${trimmed}%`),
          ilike(notes.classLevel, `%${trimmed}%`)
        )
      : undefined;

    const [totalRow] = await db
      .select({ value: count() })
      .from(notes)
      .where(whereClause);

    const rows = await db
      .select({
        id: notes.id,
        userId: notes.userId,
        uploaderName: notes.uploaderName,
        uploaderEmail: users.email,
        title: notes.title,
        subject: notes.subject,
        classLevel: notes.classLevel,
        tags: notes.tags,
        contentText: notes.contentText,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        fileType: notes.fileType,
        fileSize: notes.fileSize,
        downloads: notes.downloads,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.uid))
      .where(whereClause)
      .orderBy(desc(notes.createdAt), desc(notes.id))
      .limit(safeLimit)
      .offset(offset);

    const total = Number(totalRow?.value ?? 0);
    return {
      items: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  } catch (error) {
    console.error('Database query failed in listAllNotesAdmin:', error);
    throw new Error('Failed to list academic notes.', { cause: error });
  }
}

export async function deleteNoteByAdmin(noteId: number) {
  try {
    const rows = await db
      .delete(notes)
      .where(eq(notes.id, noteId))
      .returning({ id: notes.id, title: notes.title });
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in deleteNoteByAdmin:', error);
    throw new Error('Failed to delete note.', { cause: error });
  }
}

export async function listAllChatsAdmin(search = '', page = 1, limit = 20) {
  try {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const trimmed = search.trim();
    const whereClause = trimmed
      ? or(
          ilike(chats.title, `%${trimmed}%`),
          ilike(users.name, `%${trimmed}%`),
          ilike(users.email, `%${trimmed}%`)
        )
      : undefined;

    const [totalRow] = await db
      .select({ value: count() })
      .from(chats)
      .leftJoin(users, eq(chats.userId, users.uid))
      .where(whereClause);

    const rows = await db
      .select({
        id: chats.id,
        userId: chats.userId,
        title: chats.title,
        createdAt: chats.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(chats)
      .leftJoin(users, eq(chats.userId, users.uid))
      .where(whereClause)
      .orderBy(desc(chats.createdAt), desc(chats.id))
      .limit(safeLimit)
      .offset(offset);

    const enriched = await Promise.all(
      rows.map(async (row) => {
        const [msgCountRow] = await db
          .select({ value: count() })
          .from(messages)
          .where(eq(messages.chatId, row.id));
        return {
          ...row,
          messageCount: Number(msgCountRow?.value ?? 0),
        };
      })
    );

    const total = Number(totalRow?.value ?? 0);
    return {
      items: enriched,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  } catch (error) {
    console.error('Database query failed in listAllChatsAdmin:', error);
    throw new Error('Failed to list AI conversations.', { cause: error });
  }
}

export async function getChatWithMessagesAdmin(chatId: number) {
  try {
    const chatRows = await db
      .select({
        id: chats.id,
        userId: chats.userId,
        title: chats.title,
        createdAt: chats.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(chats)
      .leftJoin(users, eq(chats.userId, users.uid))
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chatRows[0]) return null;

    const msgRows = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt, messages.id);

    return {
      ...chatRows[0],
      messages: msgRows,
    };
  } catch (error) {
    console.error('Database query failed in getChatWithMessagesAdmin:', error);
    throw new Error('Failed to load conversation transcript.', { cause: error });
  }
}

export async function deleteChatByAdmin(chatId: number) {
  try {
    const rows = await db
      .delete(chats)
      .where(eq(chats.id, chatId))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in deleteChatByAdmin:', error);
    throw new Error('Failed to delete conversation.', { cause: error });
  }
}

export async function listAllCVsAdmin(search = '', page = 1, limit = 20) {
  try {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const trimmed = search.trim();
    const whereClause = trimmed
      ? or(
          ilike(cvs.title, `%${trimmed}%`),
          ilike(cvs.templateId, `%${trimmed}%`),
          ilike(users.name, `%${trimmed}%`),
          ilike(users.email, `%${trimmed}%`)
        )
      : undefined;

    const [totalRow] = await db
      .select({ value: count() })
      .from(cvs)
      .leftJoin(users, eq(cvs.userId, users.uid))
      .where(whereClause);

    const rows = await db
      .select({
        id: cvs.id,
        userId: cvs.userId,
        title: cvs.title,
        templateId: cvs.templateId,
        createdAt: cvs.createdAt,
        updatedAt: cvs.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(cvs)
      .leftJoin(users, eq(cvs.userId, users.uid))
      .where(whereClause)
      .orderBy(desc(cvs.updatedAt), desc(cvs.id))
      .limit(safeLimit)
      .offset(offset);

    const total = Number(totalRow?.value ?? 0);
    return {
      items: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  } catch (error) {
    console.error('Database query failed in listAllCVsAdmin:', error);
    throw new Error('Failed to list ATS resumes.', { cause: error });
  }
}

export async function deleteCVByAdmin(cvId: number) {
  try {
    const rows = await db
      .delete(cvs)
      .where(eq(cvs.id, cvId))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in deleteCVByAdmin:', error);
    throw new Error('Failed to delete ATS resume.', { cause: error });
  }
}

export async function getUserFullActivityAdmin(uid: string) {
  try {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    const target = userRows[0];
    if (!target) return null;

    const userChats = await db
      .select({
        id: chats.id,
        title: chats.title,
        createdAt: chats.createdAt,
        messageCount: sql<number>`(select count(*)::int from messages where messages.chat_id = ${chats.id})`,
      })
      .from(chats)
      .where(eq(chats.userId, uid))
      .orderBy(desc(chats.createdAt))
      .limit(30);

    const userNotes = await db
      .select({
        id: notes.id,
        userId: notes.userId,
        uploaderName: notes.uploaderName,
        title: notes.title,
        subject: notes.subject,
        classLevel: notes.classLevel,
        tags: notes.tags,
        contentText: notes.contentText,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        fileType: notes.fileType,
        fileSize: notes.fileSize,
        downloads: notes.downloads,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(eq(notes.userId, uid))
      .orderBy(desc(notes.createdAt))
      .limit(30);

    const userCVs = await db
      .select({
        id: cvs.id,
        title: cvs.title,
        templateId: cvs.templateId,
        createdAt: cvs.createdAt,
        updatedAt: cvs.updatedAt,
      })
      .from(cvs)
      .where(eq(cvs.userId, uid))
      .orderBy(desc(cvs.updatedAt))
      .limit(30);

    const authProvider: 'google' | 'password' | 'both' =
      target.googleId && target.passwordHash
        ? 'both'
        : target.googleId
          ? 'google'
          : 'password';

    return {
      user: {
        id: target.id,
        uid: target.uid,
        name: target.name,
        email: target.email,
        avatar: target.avatar,
        googleId: target.googleId,
        hasPassword: Boolean(target.passwordHash),
        authProvider,
        createdAt: target.createdAt,
      },
      chats: userChats.map((c) => ({
        ...c,
        messageCount: Number(c.messageCount ?? 0),
      })),
      notes: userNotes,
      cvs: userCVs,
    };
  } catch (error) {
    console.error('Database query failed in getUserFullActivityAdmin:', error);
    throw new Error('Failed to load user activity details.', { cause: error });
  }
}

