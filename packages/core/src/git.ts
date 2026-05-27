import { simpleGit, type SimpleGit, type StatusResult } from 'simple-git';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface GitBaseline {
  currentRef: string;
  currentBranch: string;
  hasUncommittedChanges: boolean;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  previousPath?: string;
}

export interface GitDiffResult {
  patch: string;
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}

export async function captureGitBaseline(repoPath: string): Promise<GitBaseline> {
  const git: SimpleGit = simpleGit(repoPath);

  const [revParse, branch, status] = await Promise.all([
    git.revparse('HEAD').catch(() => 'no-commits-yet'),
    git.branch().then((b) => b.current).catch(() => 'unknown'),
    git.status(),
  ]);

  return {
    currentRef: revParse,
    currentBranch: branch,
    hasUncommittedChanges: !status.isClean(),
  };
}

export async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    const git = simpleGit(dirPath);
    await git.revparse('--is-inside-work-tree');
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the git repository root by walking up from the given directory.
 * Returns the absolute path of the repo root, or null if not inside a git repo.
 */
export async function findGitRoot(startDir: string): Promise<string | null> {
  try {
    const git = simpleGit(startDir);
    const root = await git.revparse('--show-toplevel');
    return root.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get unified diff string for all changes in the repo.
 */
export async function getFullDiff(repoPath: string): Promise<string> {
  const git = simpleGit(repoPath);
  try {
    return await git.diff(['HEAD', '--', '.']);
  } catch {
    // Fallback: diff working tree vs index (unstaged + staged)
    return await git.diff().catch(() => '');
  }
}

/**
 * Parse git diff --stat output into structured file changes.
 */
export async function getDiffStat(repoPath: string): Promise<{
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}> {
  const git = simpleGit(repoPath);
  let status: StatusResult;
  try {
    status = await git.status();
  } catch {
    return { files: [], totalAdditions: 0, totalDeletions: 0 };
  }

  const files: FileChange[] = [];
  const allFiles = [
    ...status.created.map((f) => ({ path: f, status: 'added' as const })),
    ...status.modified.map((f) => ({ path: f, status: 'modified' as const })),
    ...status.deleted.map((f) => ({ path: f, status: 'deleted' as const })),
    ...status.renamed.map((f) => ({ path: f.to, status: 'renamed' as const, previousPath: f.from })),
  ];

  for (const f of allFiles) {
    try {
      const numStat = await git.diffSummary(['HEAD', '--', f.path]);
      files.push({
        ...f,
        additions: numStat.insertions,
        deletions: numStat.deletions,
      });
    } catch {
      files.push({ ...f, additions: 0, deletions: 0 });
    }
  }

  return {
    files,
    totalAdditions: files.reduce((sum, f) => sum + f.additions, 0),
    totalDeletions: files.reduce((sum, f) => sum + f.deletions, 0),
  };
}

/**
 * Capture full diff and save to patch file.
 */
export async function captureDiffToFile(
  repoPath: string,
  gitDir: string,
  filename: string
): Promise<GitDiffResult> {
  const patch = await getFullDiff(repoPath);
  const stat = await getDiffStat(repoPath);

  if (patch.trim()) {
    await writeFile(path.join(gitDir, filename), patch, 'utf8');
  }

  return {
    patch,
    files: stat.files,
    totalAdditions: stat.totalAdditions,
    totalDeletions: stat.totalDeletions,
  };
}
