import { GitHubIntegration } from '../../src/integrations/github.js';
import { Octokit } from '@octokit/rest';

jest.mock('@octokit/rest');

describe('GitHubIntegration', () => {
  let github: GitHubIntegration;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(() => {
    mockOctokit = {
      pulls: {
        get: jest.fn(),
        listFiles: jest.fn(),
        listCommits: jest.fn(),
        listReviews: jest.fn(),
      },
      issues: {
        get: jest.fn(),
        listComments: jest.fn(),
      },
      repos: {
        createRelease: jest.fn(),
        listCommits: jest.fn(),
        listContributors: jest.fn(),
        listLanguages: jest.fn(),
        createCommitStatus: jest.fn(),
      },
    } as any;

    (Octokit as jest.Mock).mockImplementation(() => mockOctokit);

    github = new GitHubIntegration({
      token: 'test-token',
      organization: 'test-org',
    });
  });

  describe('getPRDetails', () => {
    it('should fetch and format PR details correctly', async () => {
      const mockPRData = {
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test description',
          state: 'open',
          user: { login: 'testuser' },
          created_at: '2023-01-01T00:00:00Z',
          changed_files: 3,
          additions: 100,
          deletions: 50,
          head: { sha: 'abc123' },
        },
      };

      const mockFilesData = {
        data: [{
          filename: 'test.ts',
          status: 'modified',
          additions: 50,
          deletions: 25,
          changes: 75,
          patch: '@@ test patch @@',
        }],
      };

      const mockCommitsData = {
        data: [{
          sha: 'commit1',
          commit: { message: 'Test commit' },
          author: { login: 'testuser' },
        }],
      };

      const mockReviewsData = {
        data: [{
          user: { login: 'reviewer' },
          state: 'APPROVED',
          submitted_at: '2023-01-02T00:00:00Z',
        }],
      };

      mockOctokit.pulls.get.mockResolvedValue(mockPRData);
      mockOctokit.pulls.listFiles.mockResolvedValue(mockFilesData);
      mockOctokit.pulls.listCommits.mockResolvedValue(mockCommitsData);
      mockOctokit.pulls.listReviews.mockResolvedValue(mockReviewsData);

      const result = await github.getPRDetails('owner', 'repo', 123);

      expect(result).toMatchObject({
        number: 123,
        title: 'Test PR',
        body: 'Test description',
        state: 'open',
        author: 'testuser',
        changedFiles: 3,
        additions: 100,
        deletions: 50,
      });

      expect(result.files).toHaveLength(1);
      expect(result.commits).toHaveLength(1);
      expect(result.reviews).toHaveLength(1);
    });

    it('should handle API errors gracefully', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('API Error'));

      await expect(github.getPRDetails('owner', 'repo', 123))
        .rejects.toThrow('Failed to fetch PR details: API Error');
    });
  });

  describe('createRelease', () => {
    it('should create a release successfully', async () => {
      const mockReleaseData = {
        data: {
          tag_name: 'v1.0.0',
          name: 'Release v1.0.0',
          body: 'Release notes',
          draft: false,
          prerelease: false,
          created_at: '2023-01-01T00:00:00Z',
          published_at: '2023-01-01T01:00:00Z',
          author: { login: 'releaser' },
        },
      };

      mockOctokit.repos.createRelease.mockResolvedValue(mockReleaseData);

      const result = await github.createRelease('owner', 'repo', {
        tag_name: 'v1.0.0',
        name: 'Release v1.0.0',
        body: 'Release notes',
      });

      expect(result).toMatchObject({
        tagName: 'v1.0.0',
        name: 'Release v1.0.0',
        body: 'Release notes',
        draft: false,
        prerelease: false,
        author: 'releaser',
      });

      expect(mockOctokit.repos.createRelease).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        tag_name: 'v1.0.0',
        name: 'Release v1.0.0',
        body: 'Release notes',
      });
    });
  });

  describe('updatePRStatus', () => {
    it('should update PR status successfully', async () => {
      const mockPRData = {
        data: {
          head: { sha: 'abc123' },
        },
      };

      mockOctokit.pulls.get.mockResolvedValue(mockPRData);
      mockOctokit.repos.createCommitStatus.mockResolvedValue({ data: {} });

      await github.updatePRStatus('owner', 'repo', 123, 'success', 'All checks passed');

      expect(mockOctokit.repos.createCommitStatus).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        sha: 'abc123',
        state: 'success',
        description: 'All checks passed',
        context: 'IDWO/workflow',
      });
    });
  });
});