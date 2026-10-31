import type {
  CVDocumentData,
  CVCertificationItem,
  CVEducationItem,
  CVExperienceItem,
  CVPersonalDetails,
  CVProjectItem,
} from '../db/schema.ts';

export type {
  CVDocumentData,
  CVCertificationItem,
  CVEducationItem,
  CVExperienceItem,
  CVPersonalDetails,
  CVProjectItem,
};

export const OWNER_ADMIN_EMAIL = 'deenuverma238@gmail.com';

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  avatar: string | null;
  authProvider: 'google' | 'password';
  hasPassword?: boolean;
  isAdmin?: boolean;
  createdAt: string;
}

export function isOwnerAdminUser(user?: UserProfile | null): boolean {
  return Boolean(
    user &&
      user.isAdmin === true &&
      user.email.trim().toLowerCase() === OWNER_ADMIN_EMAIL
  );
}

export interface UserStats {
  chats: number;
  notes: number;
  cvs: number;
}

export interface AdminOverviewData {
  totals: {
    users: number;
    googleUsers: number;
    passwordUsers: number;
    chats: number;
    messages: number;
    notes: number;
    noteDownloads: number;
    noteStorageBytes: number;
    cvs: number;
  };
  recentUsers: {
    id: number;
    uid: string;
    name: string;
    email: string;
    avatar: string | null;
    authProvider: 'google' | 'password' | 'both';
    createdAt: string;
  }[];
  topNotes: {
    id: number;
    title: string;
    subject: string;
    classLevel: string;
    uploaderName: string;
    fileSize: number;
    downloads: number;
    createdAt: string;
  }[];
}

export interface AdminUserItem {
  id: number;
  uid: string;
  name: string;
  email: string;
  avatar: string | null;
  authProvider: 'google' | 'password' | 'both';
  createdAt: string;
  chatsCount: number;
  notesCount: number;
  cvsCount: number;
}

export interface AdminUserFullDetail {
  user: {
    id: number;
    uid: string;
    name: string;
    email: string;
    avatar: string | null;
    googleId: string | null;
    hasPassword: boolean;
    authProvider: 'google' | 'password' | 'both';
    createdAt: string;
  };
  chats: {
    id: number;
    title: string;
    createdAt: string;
    messageCount: number;
  }[];
  notes: NoteItem[];
  cvs: {
    id: number;
    title: string;
    templateId: string;
    createdAt: string;
    updatedAt: string;
  }[];
}

export interface AdminNoteItem extends NoteItem {
  uploaderEmail: string | null;
}

export interface AdminChatItem {
  id: number;
  userId: string;
  title: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  messageCount: number;
}

export interface AdminChatDetail {
  id: number;
  userId: string;
  title: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  messages: ChatMessage[];
}

export interface AdminCVItem {
  id: number;
  userId: string;
  title: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ChatSummary {
  id: number;
  userId: string;
  title: string;
  createdAt: string;
}

export interface ChatMessage {
  id: number | string;
  chatId: number;
  role: 'user' | 'assistant';
  content: string;
  language: string;
  createdAt: string;
}

export interface ChatDetail extends ChatSummary {
  messages: ChatMessage[];
}

export interface NoteItem {
  id: number;
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
  downloads: number;
  createdAt: string;
}

export type CVTemplateId = 'classic' | 'executive' | 'technical';

export interface CVRecord {
  id: number;
  userId: string;
  title: string;
  templateId: CVTemplateId;
  data: CVDocumentData;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyCVData(name = '', email = ''): CVDocumentData {
  return {
    personal: {
      fullName: name,
      jobTitle: '',
      email: email,
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      website: '',
    },
    summary: '',
    education: [
      {
        id: 'edu-initial',
        institution: '',
        degree: '',
        field: '',
        location: '',
        startDate: '',
        endDate: '',
        grade: '',
      },
    ],
    skills: {
      languages: '',
      frameworks: '',
      tools: '',
      core: '',
    },
    experience: [
      {
        id: 'exp-initial',
        company: '',
        role: '',
        location: '',
        startDate: '',
        endDate: '',
        highlights: [''],
      },
    ],
    projects: [
      {
        id: 'proj-initial',
        name: '',
        techStack: '',
        link: '',
        description: [''],
      },
    ],
    certifications: [],
  };
}

export function createSampleCVData(): CVDocumentData {
  return {
    personal: {
      fullName: 'Aarav Verma',
      jobTitle: 'Full-Stack Software Engineer',
      email: 'aarav.verma@example.com',
      phone: '+91 98110 24580',
      location: 'New Delhi, India',
      linkedin: 'linkedin.com/in/aarav-verma',
      github: 'github.com/aarav-verma',
      website: 'aaravverma.dev',
    },
    summary:
      'Results-driven Full-Stack Software Engineer with hands-on experience designing TypeScript, React, Node.js, and PostgreSQL web applications. Proven track record optimizing database query performance, implementing real-time SSE streaming interfaces, and shipping accessible cross-device products.',
    education: [
      {
        id: 'edu-sample-1',
        institution: 'Delhi Technological University',
        degree: 'Bachelor of Technology',
        field: 'Computer Science & Engineering',
        location: 'New Delhi, India',
        startDate: 'Aug 2022',
        endDate: 'May 2026',
        grade: '9.1 / 10.0',
      },
    ],
    skills: {
      languages: 'TypeScript, JavaScript (ES2023), Python, SQL, C++',
      frameworks: 'React, Next.js, Node.js, Express.js, Tailwind CSS, Drizzle ORM',
      tools: 'PostgreSQL, Docker, Git, GitHub Actions, Linux, REST APIs',
      core: 'Data Structures & Algorithms, Database Normalization, System Architecture, Web Accessibility (WCAG AA)',
    },
    experience: [
      {
        id: 'exp-sample-1',
        company: 'Meridian Cloud Systems',
        role: 'Software Engineering Intern',
        location: 'Bengaluru, India',
        startDate: 'May 2025',
        endDate: 'Aug 2025',
        highlights: [
          'Built low-latency Server-Sent Events (SSE) API endpoints in Express and TypeScript serving 35,000+ daily requests.',
          'Reduced PostgreSQL search latency by 58% across academic records using targeted composite indexing and pagination.',
          'Collaborated with product designers to ship responsive mobile-first workflows achieving 99+ Lighthouse accessibility scores.',
        ],
      },
    ],
    projects: [
      {
        id: 'proj-sample-1',
        name: 'NOVAAI Study & Career Suite',
        techStack: 'TypeScript, React, Express, PostgreSQL',
        link: 'github.com/aarav-verma/novaai',
        description: [
          'Architected a multilingual streaming AI assistant with Web Speech API voice input, TTS playback, and persistent chat sessions.',
          'Engineered a server-side ATS-compliant PDF generator producing single-column, selectable-text resumes.',
        ],
      },
      {
        id: 'proj-sample-2',
        name: 'Distributed Task Queue & Telemetry Engine',
        techStack: 'Node.js, PostgreSQL, Docker',
        link: 'github.com/aarav-verma/pg-queue',
        description: [
          'Implemented transactional job locking using PostgreSQL SKIP LOCKED with exponential backoff and dead-letter recovery.',
        ],
      },
    ],
    certifications: [
      {
        id: 'cert-sample-1',
        name: 'Google Cloud Associate Cloud Engineer',
        issuer: 'Google Cloud',
        date: '2025',
        credentialUrl: '',
      },
    ],
  };
}
