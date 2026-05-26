import { simpleGit, type SimpleGit } from 'simple-git';

export interface GitBaseline {
  currentRef: string;
  currentBranch: string;
  hasUncommittedChanges: boolean;
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
