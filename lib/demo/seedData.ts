export interface SeedSkill {
  skillCode: string;
  name: string;
  category: string;
  description: string;
  /** One of the official PDF badges: BDG-AI-001 (focused), BDG-AI-002 (applied) or BDG-AI-003 (advanced). */
  badgeId: 'BDG-AI-001' | 'BDG-AI-002' | 'BDG-AI-003';
}

export interface SeedStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SeedCredential {
  recordId: string;
  studentId: string;
  skillCode: string;
  /** YYYY-MM-DD */
  earnedAt: string;
}

export const SEED_SKILLS: SeedSkill[] = [
  {
    skillCode: 'AI-101',
    name: 'Generative AI Fundamentals',
    category: 'Foundations',
    description: 'Explains how large language models work and where they fit in professional workflows.',
    badgeId: 'BDG-AI-001',
  },
  {
    skillCode: 'AI-102',
    name: 'Prompt Engineering',
    category: 'Foundations',
    description: 'Designs structured prompts that produce reliable, reviewable model output.',
    badgeId: 'BDG-AI-001',
  },
  {
    skillCode: 'AI-103',
    name: 'AI Ethics and Responsible Use',
    category: 'Foundations',
    description: 'Applies fairness, privacy and transparency principles when adopting AI tools.',
    badgeId: 'BDG-AI-001',
  },
  {
    skillCode: 'AI-201',
    name: 'AI Workflow Automation',
    category: 'Applied',
    description: 'Automates multi-step business processes by combining AI services with existing tools.',
    badgeId: 'BDG-AI-002',
  },
  {
    skillCode: 'AI-202',
    name: 'Building AI Agents',
    category: 'Applied',
    description: 'Builds tool-using agents with guardrails, evaluation and human oversight.',
    badgeId: 'BDG-AI-002',
  },
  {
    skillCode: 'AI-301',
    name: 'Data Analysis with AI',
    category: 'Advanced',
    description: 'Cleans, explores and interprets datasets with AI-assisted analysis and validation.',
    badgeId: 'BDG-AI-003',
  },
  {
    skillCode: 'AI-302',
    name: 'Machine Learning in Practice',
    category: 'Advanced',
    description: 'Trains, evaluates and deploys a supervised model on a real-world dataset.',
    badgeId: 'BDG-AI-003',
  },
];

// The demo student is created separately so its email can follow the DEMO_STUDENT_EMAIL setting.
export const SEED_STUDENTS: SeedStudent[] = [
  { studentId: 'STU-2024-0142', firstName: 'Daniel', lastName: 'Okafor', email: 'daniel.okafor@example.com' },
  { studentId: 'STU-2024-0231', firstName: 'Sofia', lastName: 'Marchetti', email: 'sofia.marchetti@example.com' },
  { studentId: 'STU-2025-0017', firstName: 'Liam', lastName: 'Chen', email: 'liam.chen@example.com' },
  { studentId: 'STU-2025-0088', firstName: 'Priya', lastName: 'Raman', email: 'priya.raman@example.com' },
];

export const SEED_CREDENTIALS: SeedCredential[] = [
  { recordId: 'SEED-0001', studentId: 'DEMO-2026-0001', skillCode: 'AI-101', earnedAt: '2026-02-14' },
  { recordId: 'SEED-0002', studentId: 'DEMO-2026-0001', skillCode: 'AI-102', earnedAt: '2026-04-03' },
  { recordId: 'SEED-0003', studentId: 'DEMO-2026-0001', skillCode: 'AI-201', earnedAt: '2026-06-19' },
  { recordId: 'SEED-0004', studentId: 'STU-2024-0142', skillCode: 'AI-101', earnedAt: '2026-01-29' },
  { recordId: 'SEED-0005', studentId: 'STU-2024-0142', skillCode: 'AI-103', earnedAt: '2026-05-22' },
  { recordId: 'SEED-0006', studentId: 'STU-2024-0231', skillCode: 'AI-101', earnedAt: '2026-02-05' },
  { recordId: 'SEED-0007', studentId: 'STU-2024-0231', skillCode: 'AI-202', earnedAt: '2026-05-08' },
  { recordId: 'SEED-0008', studentId: 'STU-2024-0231', skillCode: 'AI-301', earnedAt: '2026-08-27' },
  { recordId: 'SEED-0009', studentId: 'STU-2024-0231', skillCode: 'AI-302', earnedAt: '2026-10-09' },
  { recordId: 'SEED-0010', studentId: 'STU-2025-0017', skillCode: 'AI-102', earnedAt: '2026-03-18' },
  { recordId: 'SEED-0011', studentId: 'STU-2025-0088', skillCode: 'AI-101', earnedAt: '2026-03-02' },
  { recordId: 'SEED-0012', studentId: 'STU-2025-0088', skillCode: 'AI-201', earnedAt: '2026-07-15' },
];
