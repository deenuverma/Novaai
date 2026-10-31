import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(80)
    .optional(),
  avatar: z.string().trim().url('Avatar must be a valid URL.').nullable().optional(),
});

export const chatRequestSchema = z.object({
  chatId: z.number().int().positive().nullable().optional(),
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(12000, 'Message is too long.'),
  language: z.string().trim().max(40).default('auto'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(12000),
      })
    )
    .max(20)
    .optional(),
});

export const createNoteMetadataSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(140),
  subject: z.string().trim().min(2, 'Subject is required.').max(80),
  classLevel: z.string().trim().min(1, 'Class or semester is required.').max(60),
  tags: z.string().optional().default(''),
  contentSummary: z.string().max(15000).optional().default(''),
});

export const cvPersonalSchema = z.object({
  fullName: z.string().max(120).default(''),
  email: z.string().max(120).default(''),
  phone: z.string().max(40).default(''),
  location: z.string().max(120).default(''),
  linkedin: z.string().max(200).default(''),
  github: z.string().max(200).default(''),
  website: z.string().max(200).default(''),
  jobTitle: z.string().max(120).default(''),
});

export const cvDataSchema = z.object({
  personal: cvPersonalSchema,
  summary: z.string().max(3000).default(''),
  education: z
    .array(
      z.object({
        id: z.string(),
        institution: z.string().max(160).default(''),
        degree: z.string().max(160).default(''),
        field: z.string().max(160).default(''),
        location: z.string().max(120).default(''),
        startDate: z.string().max(40).default(''),
        endDate: z.string().max(40).default(''),
        grade: z.string().max(60).default(''),
      })
    )
    .default([]),
  skills: z
    .object({
      languages: z.string().max(600).default(''),
      frameworks: z.string().max(600).default(''),
      tools: z.string().max(600).default(''),
      core: z.string().max(600).default(''),
    })
    .default({ languages: '', frameworks: '', tools: '', core: '' }),
  experience: z
    .array(
      z.object({
        id: z.string(),
        company: z.string().max(160).default(''),
        role: z.string().max(160).default(''),
        location: z.string().max(120).default(''),
        startDate: z.string().max(40).default(''),
        endDate: z.string().max(40).default(''),
        highlights: z.array(z.string().max(600)).default([]),
      })
    )
    .default([]),
  projects: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(160).default(''),
        techStack: z.string().max(240).default(''),
        link: z.string().max(240).default(''),
        description: z.array(z.string().max(600)).default([]),
      })
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(160).default(''),
        issuer: z.string().max(160).default(''),
        date: z.string().max(40).default(''),
        credentialUrl: z.string().max(240).default(''),
      })
    )
    .default([]),
});

export const saveCVSchema = z.object({
  title: z.string().trim().min(1, 'CV title is required.').max(120),
  templateId: z.enum(['classic', 'executive', 'technical']).default('classic'),
  data: cvDataSchema,
});
