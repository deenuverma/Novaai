import dotenv from 'dotenv';
import {
  createCVRecord,
  createNoteRecord,
  getOrCreateOAuthUser,
  listNotesQuery,
} from '../src/db/repositories.ts';
import { generateStudyNotePdfBuffer } from './services/pdfService.ts';

dotenv.config();

async function runSeed() {
  console.log('Starting NOVAAI database seed...');

  const author = await getOrCreateOAuthUser({
    uid: 'novaai_seed_author',
    email: 'seed@novaai.edu',
    name: 'Dr. Vikram Mehta',
    googleId: null,
  });

  const existing = await listNotesQuery({ page: 1, limit: 1 });
  if (existing.pagination.total === 0) {
    const sysDesignPdf = await generateStudyNotePdfBuffer({
      title: 'Distributed Systems: Consensus, Replication & Partitioning',
      subject: 'System Design',
      classLevel: 'Semester 7',
      author: author.name,
      sections: [
        {
          heading: '1. Replication Topologies',
          body: 'Single-leader replication routes writes through one primary node and streams WAL segments to read replicas. Multi-leader and leaderless (Dynamo-style quorum R + W > N) trade strict consistency for cross-region write availability.',
        },
        {
          heading: '2. Consistent Hashing & Partition Rebalancing',
          body: 'Consistent hashing maps nodes and keys onto a hash ring with virtual nodes, minimizing key movement to O(K/N) when cluster capacity scales up or down.',
        },
      ],
    });

    await createNoteRecord({
      userId: author.uid,
      uploaderName: author.name,
      title: 'Distributed Systems: Consensus, Replication & Partitioning',
      subject: 'System Design',
      classLevel: 'Semester 7',
      tags: ['distributed-systems', 'raft', 'replication', 'sharding'],
      fileUrl: '/api/notes/1/preview',
      fileName: 'distributed-systems-notes.pdf',
      fileType: 'application/pdf',
      fileSize: sysDesignPdf.byteLength,
      fileData: sysDesignPdf.toString('base64'),
    });
  }

  await createCVRecord({
    userId: author.uid,
    title: 'Software Engineer ATS Resume',
    templateId: 'executive',
    data: {
      personal: {
        fullName: 'Rohan Sharma',
        jobTitle: 'Full-Stack Software Engineer',
        email: 'rohan.sharma@example.edu',
        phone: '+91 98765 43210',
        location: 'Bengaluru, India',
        linkedin: 'linkedin.com/in/rohansharma-dev',
        github: 'github.com/rohansharma-dev',
        website: 'rohansharma.dev',
      },
      summary:
        'Full-Stack Software Engineer specializing in TypeScript, React, Node.js, and PostgreSQL systems. Built scalable web applications handling 50k+ monthly active learners with sub-150ms median API latency.',
      education: [
        {
          id: 'edu-1',
          institution: 'National Institute of Technology',
          degree: 'B.Tech',
          field: 'Computer Science and Engineering',
          location: 'Karnataka, India',
          startDate: 'Aug 2022',
          endDate: 'May 2026',
          grade: '8.9 / 10.0',
        },
      ],
      skills: {
        languages: 'TypeScript, JavaScript, Python, SQL, C++',
        frameworks: 'React, Next.js, Express.js, Tailwind CSS, Drizzle ORM',
        tools: 'PostgreSQL, Docker, Git, GitHub Actions, Linux',
        core: 'Data Structures & Algorithms, REST APIs, System Design, Database Indexing',
      },
      experience: [
        {
          id: 'exp-1',
          company: 'CloudScale Labs',
          role: 'Software Engineering Intern',
          location: 'Bengaluru, India',
          startDate: 'May 2025',
          endDate: 'Aug 2025',
          highlights: [
            'Engineered real-time SSE streaming endpoints in Node.js and TypeScript, reducing time-to-first-token by 42%.',
            'Optimized PostgreSQL search queries across 120,000+ academic documents using composite indexes.',
          ],
        },
      ],
      projects: [
        {
          id: 'proj-1',
          name: 'NOVAAI Academic Workspace',
          techStack: 'TypeScript, React, Express, PostgreSQL',
          link: 'github.com/rohansharma-dev/novaai',
          description: [
            'Built a multilingual AI study assistant with live SSE token streaming, voice input, and persistent conversation history.',
            'Designed an ATS-compliant single-column PDF resume generator with instant live preview.',
          ],
        },
      ],
      certifications: [
        {
          id: 'cert-1',
          name: 'Google Cloud Associate Cloud Engineer',
          issuer: 'Google Cloud',
          date: '2025',
          credentialUrl: '',
        },
      ],
    },
  });

  console.log('NOVAAI seed completed successfully.');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
