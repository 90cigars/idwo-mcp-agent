import { Octokit } from '@octokit/rest';
import logger from '../utils/logger.js';
import { ServiceError } from '../types/index.js';

export interface GitHubConfig {
  token: string;
  organization?: string;
}

export interface PRDetails {
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  createdAt: string;
  changedFiles: number;
  additions: number;
  deletions: number;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }>;
  commits: Array<{
    sha: string;
    message: string;
    author: string;
  }>;
  reviews: Array<{
    user: string;
    state: string;
    submittedAt: string;
  }>;
}

export interface IssueDetails {
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  assignees: string[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
  comments: Array<{
    author: string;
    body: string;
    createdAt: string;
  }>;
}

export interface ReleaseInfo {
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  publishedAt?: string;
  author: string;
}

export class GitHubIntegration {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
      userAgent: 'IDWO-MCP-Server/1.0.0',
    });
  }

  async getPRDetails(owner: string, repo: string, pullNumber: number): Promise<PRDetails> {
    try {
      const [prResponse, filesResponse, commitsResponse, reviewsResponse] = await Promise.all([
        this.octokit.pulls.get({ owner, repo, pull_number: pullNumber }),
        this.octokit.pulls.listFiles({ owner, repo, pull_number: pullNumber }),
        this.octokit.pulls.listCommits({ owner, repo, pull_number: pullNumber }),
        this.octokit.pulls.listReviews({ owner, repo, pull_number: pullNumber }),
      ]);

      const pr = prResponse.data;
      const files = filesResponse.data;
      const commits = commitsResponse.data;
      const reviews = reviewsResponse.data;

      return {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: pr.state,
        author: pr.user?.login || 'unknown',
        createdAt: pr.created_at,
        changedFiles: pr.changed_files || 0,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        files: files.map(file => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch,
        })),
        commits: commits.map(commit => ({
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.author?.login || commit.commit.author?.name || 'unknown',
        })),
        reviews: reviews.map(review => ({
          user: review.user?.login || 'unknown',
          state: review.state,
          submittedAt: review.submitted_at || '',
        })),
      };
    } catch (error) {
      logger.error('Failed to fetch PR details', { owner, repo, pullNumber, error });
      throw new ServiceError(`Failed to fetch PR details: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'github',
        statusCode: error instanceof Error && 'status' in error ? (error as any).status : undefined,
        retryable: true,
      });
    }
  }

  async getIssueDetails(owner: string, repo: string, issueNumber: number): Promise<IssueDetails> {
    try {
      const [issueResponse, commentsResponse] = await Promise.all([
        this.octokit.issues.get({ owner, repo, issue_number: issueNumber }),
        this.octokit.issues.listComments({ owner, repo, issue_number: issueNumber }),
      ]);

      const issue = issueResponse.data;
      const comments = commentsResponse.data;

      return {
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state,
        author: issue.user?.login || 'unknown',
        assignees: issue.assignees?.map(a => a.login) || [],
        labels: issue.labels?.map(l => typeof l === 'string' ? l : l.name || '') || [],
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        comments: comments.map(comment => ({
          author: comment.user?.login || 'unknown',
          body: comment.body || '',
          createdAt: comment.created_at,
        })),
      };
    } catch (error) {
      logger.error('Failed to fetch issue details', { owner, repo, issueNumber, error });
      throw new ServiceError(`Failed to fetch issue details: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'github',
        retryable: true,
      });
    }
  }

  async createRelease(owner: string, repo: string, release: {
    tag_name: string;
    name: string;
    body: string;
    draft?: boolean;
    prerelease?: boolean;
  }): Promise<ReleaseInfo> {
    try {
      const response = await this.octokit.repos.createRelease({
        owner,
        repo,
        ...release,
      });

      const releaseData = response.data;

      return {
        tagName: releaseData.tag_name,
        name: releaseData.name || '',
        body: releaseData.body || '',
        draft: releaseData.draft,
        prerelease: releaseData.prerelease,
        createdAt: releaseData.created_at,
        publishedAt: releaseData.published_at || undefined,
        author: releaseData.author?.login || 'unknown',
      };
    } catch (error) {
      logger.error('Failed to create release', { owner, repo, release, error });
      throw new ServiceError(`Failed to create release: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'github',
        retryable: false,
      });
    }
  }

  async getRepositoryStats(owner: string, repo: string, since?: string): Promise<{
    commits: number;
    pullRequests: number;
    issues: number;
    contributors: string[];
    languages: Record<string, number>;
  }> {
    try {
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [commitsResponse, pullsResponse, issuesResponse, contributorsResponse, languagesResponse] = await Promise.all([
        this.octokit.repos.listCommits({ owner, repo, since: sinceDate.toISOString(), per_page: 100 }),
        this.octokit.pulls.list({ owner, repo, state: 'all', per_page: 100 }),
        this.octokit.issues.list({ owner, repo, state: 'all', per_page: 100, since: sinceDate.toISOString() }),
        this.octokit.repos.listContributors({ owner, repo, per_page: 100 }),
        this.octokit.repos.listLanguages({ owner, repo }),
      ]);

      return {
        commits: commitsResponse.data.length,
        pullRequests: pullsResponse.data.length,
        issues: issuesResponse.data.filter(issue => !issue.pull_request).length,
        contributors: contributorsResponse.data.map(c => c.login || 'unknown').slice(0, 20),
        languages: languagesResponse.data,
      };
    } catch (error) {
      logger.error('Failed to fetch repository stats', { owner, repo, error });
      throw new ServiceError(`Failed to fetch repository stats: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'github',
        retryable: true,
      });
    }
  }

  async updatePRStatus(owner: string, repo: string, pullNumber: number, state: 'pending' | 'success' | 'error' | 'failure', description?: string): Promise<void> {
    try {
      const pr = await this.octokit.pulls.get({ owner, repo, pull_number: pullNumber });
      
      await this.octokit.repos.createCommitStatus({
        owner,
        repo,
        sha: pr.data.head.sha,
        state,
        description: description || `IDWO status update: ${state}`,
        context: 'IDWO/workflow',
      });

      logger.info('Updated PR status', { owner, repo, pullNumber, state, description });
    } catch (error) {
      logger.error('Failed to update PR status', { owner, repo, pullNumber, state, error });
      throw new ServiceError(`Failed to update PR status: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'github',
        retryable: true,
      });
    }
  }

  async searchRepositories(query: string, organization?: string): Promise<Array<{ name: string; fullName: string; description: string; stars: number }>> {
    try {
      const searchQuery = organization ? `${query} org:${organization}` : query;
      
      const response = await this.octokit.search.repos({
        q: searchQuery,
        sort: 'updated',
        per_page: 50,
      });

      return response.data.items.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        stars: repo.stargazers_count || 0,
      }));
    } catch (error) {
      logger.error('Failed to search repositories', { query, organization, error });
      throw new ServiceError(`Failed to search repositories: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'github',
        retryable: true,
      });
    }
  }

  async getTeamMembers(organization: string, teamSlug: string): Promise<string[]> {
    try {
      const response = await this.octokit.teams.listMembersInOrg({
        org: organization,
        team_slug: teamSlug,
        per_page: 100,
      });

      return response.data.map(member => member.login);
    } catch (error) {
      logger.error('Failed to fetch team members', { organization, teamSlug, error });
      throw new ServiceError(`Failed to fetch team members: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        service: 'github',
        retryable: true,
      });
    }
  }
}