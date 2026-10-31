import type {
  AdminChatDetail,
  AdminChatItem,
  AdminCVItem,
  AdminNoteItem,
  AdminOverviewData,
  AdminUserFullDetail,
  AdminUserItem,
  ChatDetail,
  ChatMessage,
  ChatSummary,
  CVDocumentData,
  CVRecord,
  CVTemplateId,
  NoteItem,
  PaginationMeta,
  UserProfile,
  UserStats,
} from '../types/models.ts';

let inMemoryAccessToken: string | null = null;
const SESSION_RT_KEY = 'novaai_session_rt';
const SESSION_HINT_KEY = 'novaai_has_session';
const SESSION_USER_CACHE_KEY = 'novaai_cached_user';

function getStoredRefreshBackup(): string | null {
  try {
    return typeof window !== 'undefined'
      ? window.sessionStorage.getItem(SESSION_RT_KEY)
      : null;
  } catch {
    return null;
  }
}

export function hasActiveSessionHint(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return (
      Boolean(window.sessionStorage.getItem(SESSION_RT_KEY)) ||
      window.localStorage.getItem(SESSION_HINT_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function getCachedSessionSnapshot(): {
  user: UserProfile;
  stats: UserStats;
} | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(SESSION_USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { user: UserProfile; stats: UserStats };
  } catch {
    return null;
  }
}

export function setCachedSessionSnapshot(
  snapshot: { user: UserProfile; stats: UserStats } | null
) {
  try {
    if (typeof window === 'undefined') return;
    if (snapshot) {
      window.sessionStorage.setItem(
        SESSION_USER_CACHE_KEY,
        JSON.stringify(snapshot)
      );
      window.localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      window.sessionStorage.removeItem(SESSION_USER_CACHE_KEY);
      window.localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    // Ignore storage restrictions
  }
}

function setStoredRefreshBackup(token: string | null) {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      window.sessionStorage.setItem(SESSION_RT_KEY, token);
      window.localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      window.sessionStorage.removeItem(SESSION_RT_KEY);
    }
  } catch {
    // Ignore sandboxed storage restrictions
  }
}

export function setInMemoryAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getInMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

export async function ensureFreshAccessToken(): Promise<string | null> {
  return resolveBearerToken(false);
}

async function resolveBearerToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && inMemoryAccessToken) {
    return inMemoryAccessToken;
  }
  if (!hasActiveSessionHint()) {
    return null;
  }
  if (forceRefresh || !inMemoryAccessToken) {
    return await tryRefreshCustomJwt();
  }
  return inMemoryAccessToken;
}

async function tryRefreshCustomJwt(): Promise<string | null> {
  try {
    const backupRt = getStoredRefreshBackup();
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: backupRt ? { 'Content-Type': 'application/json' } : undefined,
      body: backupRt ? JSON.stringify({ refreshToken: backupRt }) : undefined,
      credentials: 'include',
    });
    if (!res.ok) {
      inMemoryAccessToken = null;
      setStoredRefreshBackup(null);
      setCachedSessionSnapshot(null);
      return null;
    }
    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (data.refreshToken) {
      setStoredRefreshBackup(data.refreshToken);
    }
    if (data.accessToken) {
      inMemoryAccessToken = data.accessToken;
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const headers = new Headers(options.headers || undefined);
  const token =
    retryOn401 && !headers.has('Authorization')
      ? await resolveBearerToken(false)
      : inMemoryAccessToken;

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retryOn401 && hasActiveSessionHint()) {
    const refreshedToken = await tryRefreshCustomJwt();

    if (refreshedToken) {
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      res = await fetch(path, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody?.error) errorMsg = errBody.error;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errorMsg);
  }

  return (await res.json()) as T;
}

// ---------------- AUTH & PROFILE API ----------------

export const authApi = {
  warmup() {
    void fetch('/api/auth/warmup', { method: 'GET' }).catch(() => undefined);
  },

  async signup(payload: { name: string; email: string; password: string }) {
    const res = await apiFetch<{
      user: UserProfile;
      stats?: UserStats;
      accessToken: string;
      refreshToken?: string;
      isNewUser?: boolean;
    }>(
      '/api/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      false
    );
    setInMemoryAccessToken(res.accessToken);
    if (res.refreshToken) {
      setStoredRefreshBackup(res.refreshToken);
    }
    setCachedSessionSnapshot({
      user: res.user,
      stats: res.stats || { chats: 0, notes: 0, cvs: 0 },
    });
    return res;
  },

  async login(payload: { email: string; password: string }) {
    const res = await apiFetch<{
      user: UserProfile;
      stats?: UserStats;
      accessToken: string;
      refreshToken?: string;
    }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      false
    );
    setInMemoryAccessToken(res.accessToken);
    if (res.refreshToken) {
      setStoredRefreshBackup(res.refreshToken);
    }
    setCachedSessionSnapshot({
      user: res.user,
      stats: res.stats || { chats: 0, notes: 0, cvs: 0 },
    });
    return res;
  },

  async exchangeFirebaseSession(payload: {
    idToken?: string | null;
    googleAccessToken?: string | null;
    googleIdToken?: string | null;
  }) {
    const headers: Record<string, string> = {};
    if (payload.idToken) {
      headers.Authorization = `Bearer ${payload.idToken}`;
    }
    const res = await apiFetch<{
      user: UserProfile;
      stats: UserStats;
      accessToken: string;
      refreshToken?: string;
      isNewUser?: boolean;
    }>(
      '/api/auth/firebase-session',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      false
    );
    setInMemoryAccessToken(res.accessToken);
    if (res.refreshToken) {
      setStoredRefreshBackup(res.refreshToken);
    }
    setCachedSessionSnapshot({ user: res.user, stats: res.stats });
    return res;
  },

  async refreshSession() {
    if (!hasActiveSessionHint()) {
      return null;
    }
    try {
      const backupRt = getStoredRefreshBackup();
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: backupRt ? { 'Content-Type': 'application/json' } : undefined,
        body: backupRt ? JSON.stringify({ refreshToken: backupRt }) : undefined,
        credentials: 'include',
      });
      if (!res.ok) {
        setStoredRefreshBackup(null);
        setCachedSessionSnapshot(null);
        return null;
      }
      const data = (await res.json()) as {
        user: UserProfile;
        stats?: UserStats;
        accessToken: string;
        refreshToken?: string;
      };
      setInMemoryAccessToken(data.accessToken);
      if (data.refreshToken) {
        setStoredRefreshBackup(data.refreshToken);
      }
      setCachedSessionSnapshot({
        user: data.user,
        stats: data.stats || { chats: 0, notes: 0, cvs: 0 },
      });
      return data;
    } catch {
      return null;
    }
  },

  async logout() {
    setInMemoryAccessToken(null);
    setStoredRefreshBackup(null);
    setCachedSessionSnapshot(null);
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => undefined);
  },

  async getMe() {
    return apiFetch<{ user: UserProfile; stats: UserStats }>('/api/users/me');
  },

  async updateMe(payload: { name?: string; avatar?: string | null }) {
    return apiFetch<{ user: UserProfile; stats: UserStats }>('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async updatePassword(newPassword: string) {
    return apiFetch<{ user: UserProfile; message: string }>(
      '/api/users/me/password',
      {
        method: 'PUT',
        body: JSON.stringify({ newPassword }),
      }
    );
  },
};

// ---------------- AI CHAT SSE & CRUD API ----------------

export interface StreamChatCallbacks {
  onMeta?: (meta: { chatId: number; title: string; userMessageId: number }) => void;
  onToken: (delta: string) => void;
  onDone?: (done: {
    chatId: number;
    title: string;
    message: ChatMessage;
  }) => void;
  onError?: (errMessage: string) => void;
}

export const chatApi = {
  async listChats(page = 1) {
    return apiFetch<{ items: ChatSummary[]; pagination: PaginationMeta }>(
      `/api/chats?page=${page}`
    );
  },

  async getChat(chatId: number) {
    return apiFetch<{ chat: ChatDetail }>(`/api/chats/${chatId}`);
  },

  async deleteChat(chatId: number) {
    return apiFetch<{ success: boolean; id: number }>(`/api/chats/${chatId}`, {
      method: 'DELETE',
    });
  },

  async voiceConverse(
    payload: {
      chatId?: number | null;
      message: string;
      language?: string;
      voiceName?: string;
      voiceTone?: 'Pyari' | 'Bindaas' | 'Samajhdar' | 'Chill';
      thinkingLevel?: 'MINIMAL' | 'LOW' | 'HIGH';
      useGoogleSearch?: boolean;
      imageData?: { mimeType: string; data: string } | null;
    },
    signal?: AbortSignal
  ) {
    return apiFetch<{
      chatId: number;
      title: string;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      replyText: string;
      audioWavBase64: string | null;
      sources?: { title: string; url: string }[];
    }>('/api/chat/voice-converse', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    });
  },

  async voiceTranscribe(payload: {
    base64Audio: string;
    mimeType?: string;
    language?: string;
  }) {
    return apiFetch<{ transcript: string }>('/api/chat/voice-transcribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async synthesizeSpeech(
    payload: {
      text: string;
      voiceName?: string;
      voiceTone?: 'Pyari' | 'Bindaas' | 'Samajhdar' | 'Chill';
    },
    signal?: AbortSignal
  ) {
    return apiFetch<{ audioBase64: string | null }>('/api/chat/tts', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    });
  },

  async fetchWelcomeVoice() {
    return apiFetch<{
      audioBase64: string | null;
      welcomeText: string;
      callName: string;
    }>('/api/chat/welcome-voice', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async streamMessage(
    payload: {
      chatId?: number | null;
      message: string;
      language: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
    },
    callbacks: StreamChatCallbacks,
    signal?: AbortSignal
  ) {
    const doStreamFetch = async (bearerToken: string | null) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };
      if (bearerToken) {
        headers.Authorization = `Bearer ${bearerToken}`;
      }
      return fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include',
        signal,
      });
    };

    const token = await resolveBearerToken(false);
    let res = await doStreamFetch(token);

    if (res.status === 401) {
      const refreshed = await tryRefreshCustomJwt();
      res = await doStreamFetch(refreshed);
    }

    if (!res.ok) {
      let errText = `Chat request failed (${res.status})`;
      try {
        const errJson = (await res.json()) as { error?: string };
        if (errJson?.error) errText = errJson.error;
      } catch {
        // ignore
      }
      throw new Error(errText);
    }

    if (!res.body) {
      throw new Error('Streaming response body unavailable.');
    }

    const processFrame = (block: string) => {
      const trimmed = block.trim();
      if (!trimmed || trimmed.startsWith(':')) return;

      let eventName = 'message';
      let dataStr = '';

      for (const line of trimmed.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataStr += line.slice(5).trim();
        }
      }

      if (!dataStr) return;
      try {
        const parsed = JSON.parse(dataStr);
        if (eventName === 'meta') {
          callbacks.onMeta?.(parsed);
        } else if (eventName === 'token') {
          if (typeof parsed.text === 'string') {
            callbacks.onToken(parsed.text);
          }
        } else if (eventName === 'done') {
          callbacks.onDone?.(parsed);
        } else if (eventName === 'error') {
          callbacks.onError?.(parsed.error || 'AI streaming failed.');
        }
      } catch {
        // ignore malformed event frame
      }
    };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const block of buffer.replace(/\r\n/g, '\n').split('\n\n')) {
            processFrame(block);
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');

      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        processFrame(block);
      }
    }
  },
};

// ---------------- NOTES LIBRARY API ----------------

export const notesApi = {
  async listNotes(params: {
    search?: string;
    searchField?: 'all' | 'title' | 'subject' | 'content';
    subject?: string;
    classLevel?: string;
    mine?: boolean;
    sort?: 'newest' | 'downloads';
    page?: number;
  }) {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.searchField && params.searchField !== 'all') {
      qs.set('field', params.searchField);
    }
    if (params.subject && params.subject !== 'All') qs.set('subject', params.subject);
    if (params.classLevel && params.classLevel !== 'All') {
      qs.set('class', params.classLevel);
    }
    if (params.mine) qs.set('mine', 'true');
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));

    return apiFetch<{ items: NoteItem[]; pagination: PaginationMeta }>(
      `/api/notes?${qs.toString()}`
    );
  },

  async uploadNote(formData: FormData) {
    return apiFetch<{ note: NoteItem }>('/api/notes', {
      method: 'POST',
      body: formData,
    });
  },

  async deleteNote(noteId: number) {
    return apiFetch<{ success: boolean; id: number }>(`/api/notes/${noteId}`, {
      method: 'DELETE',
    });
  },

  async fetchPreviewResponse(noteId: number): Promise<Response> {
    const doFetch = async (bearerToken: string | null) => {
      const headers: Record<string, string> = {};
      if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
      return fetch(`/api/notes/${noteId}/preview`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
    };

    const token = await resolveBearerToken(false);
    let res = await doFetch(token);
    if (res.status === 401 && hasActiveSessionHint()) {
      const refreshed = await tryRefreshCustomJwt();
      if (refreshed) {
        res = await doFetch(refreshed);
      }
    }
    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? 'Please sign up or sign in to preview academic notes.'
          : 'Unable to load inline document preview.'
      );
    }
    return res;
  },

  async downloadNote(note: NoteItem): Promise<number | null> {
    const doFetch = async (bearerToken: string | null) => {
      const headers: Record<string, string> = {};
      if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
      return fetch(`/api/notes/${note.id}/download`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
    };

    const token = await resolveBearerToken(false);
    let res = await doFetch(token);
    if (res.status === 401 && hasActiveSessionHint()) {
      const refreshed = await tryRefreshCustomJwt();
      if (refreshed) {
        res = await doFetch(refreshed);
      }
    }
    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? 'Please sign up or sign in to download academic notes.'
          : 'Failed to download note file.'
      );
    }
    const updatedDownloadsHeader = res.headers.get('X-Note-Downloads');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = note.fileName || `${note.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    return updatedDownloadsHeader ? Number(updatedDownloadsHeader) : null;
  },
};

// ---------------- ATS CV MAKER API ----------------

export const cvApi = {
  async listCVs(page = 1) {
    return apiFetch<{ items: CVRecord[]; pagination: PaginationMeta }>(
      `/api/cv?page=${page}`
    );
  },

  async getCV(cvId: number) {
    return apiFetch<{ cv: CVRecord }>(`/api/cv/${cvId}`);
  },

  async createCV(payload: {
    title: string;
    templateId: CVTemplateId;
    data: CVDocumentData;
  }) {
    return apiFetch<{ cv: CVRecord }>('/api/cv', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCV(
    cvId: number,
    payload: {
      title: string;
      templateId: CVTemplateId;
      data: CVDocumentData;
    }
  ) {
    return apiFetch<{ cv: CVRecord }>(`/api/cv/${cvId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteCV(cvId: number) {
    return apiFetch<{ success: boolean; id: number }>(`/api/cv/${cvId}`, {
      method: 'DELETE',
    });
  },

  async downloadSavedPdf(cvId: number, fallbackFilename: string) {
    const token = await resolveBearerToken(false);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`/api/cv/${cvId}/pdf`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Failed to generate ATS PDF.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  async downloadInstantPdf(
    payload: {
      title: string;
      templateId: CVTemplateId;
      data: CVDocumentData;
    },
    fallbackFilename: string
  ) {
    const token = await resolveBearerToken(false);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch('/api/cv/export-pdf', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(
        res.status === 401
          ? 'Please sign up or sign in to export resumes.'
          : 'Failed to export PDF.'
      );
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};

// ---------------- EXCLUSIVE ADMIN DASHBOARD API ----------------

export const adminApi = {
  async getOverview() {
    return apiFetch<AdminOverviewData>('/api/admin/overview');
  },

  async listUsers(search = '', page = 1) {
    const qs = new URLSearchParams({ page: String(page) });
    if (search.trim()) qs.set('search', search.trim());
    return apiFetch<{ items: AdminUserItem[]; pagination: PaginationMeta }>(
      `/api/admin/users?${qs.toString()}`
    );
  },

  async getUserDetail(uid: string) {
    return apiFetch<AdminUserFullDetail>(
      `/api/admin/users/${encodeURIComponent(uid)}`
    );
  },

  async deleteUser(uid: string) {
    return apiFetch<{ success: boolean; uid: string }>(
      `/api/admin/users/${encodeURIComponent(uid)}`,
      { method: 'DELETE' }
    );
  },

  async listNotes(search = '', page = 1) {
    const qs = new URLSearchParams({ page: String(page) });
    if (search.trim()) qs.set('search', search.trim());
    return apiFetch<{ items: AdminNoteItem[]; pagination: PaginationMeta }>(
      `/api/admin/notes?${qs.toString()}`
    );
  },

  async deleteNote(noteId: number) {
    return apiFetch<{ success: boolean; id: number }>(
      `/api/admin/notes/${noteId}`,
      { method: 'DELETE' }
    );
  },

  async listChats(search = '', page = 1) {
    const qs = new URLSearchParams({ page: String(page) });
    if (search.trim()) qs.set('search', search.trim());
    return apiFetch<{ items: AdminChatItem[]; pagination: PaginationMeta }>(
      `/api/admin/chats?${qs.toString()}`
    );
  },

  async getChatDetail(chatId: number) {
    return apiFetch<{ chat: AdminChatDetail }>(`/api/admin/chats/${chatId}`);
  },

  async deleteChat(chatId: number) {
    return apiFetch<{ success: boolean; id: number }>(
      `/api/admin/chats/${chatId}`,
      { method: 'DELETE' }
    );
  },

  async listCVs(search = '', page = 1) {
    const qs = new URLSearchParams({ page: String(page) });
    if (search.trim()) qs.set('search', search.trim());
    return apiFetch<{ items: AdminCVItem[]; pagination: PaginationMeta }>(
      `/api/admin/cvs?${qs.toString()}`
    );
  },

  async deleteCV(cvId: number) {
    return apiFetch<{ success: boolean; id: number }>(
      `/api/admin/cvs/${cvId}`,
      { method: 'DELETE' }
    );
  },
};
