import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MOCK_SESSIONS_DIR = path.join(__dirname, '..', 'mock', 'sessions');

export const MOCK_SESSIONS = [
  { name: 'happy-path', label: 'Happy Path' },
  { name: 'retry-path', label: 'Retry Path' },
  { name: 'multi-file', label: 'Multi-File Changes' },
];
