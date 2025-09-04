import { WorkflowOrchestrator } from '../../src/workflows/orchestrator.js';
import { GitHubIntegration } from '../../src/integrations/github.js';
import { JiraIntegration } from '../../src/integrations/jira.js';
import { SlackIntegration } from '../../src/integrations/slack.js';
import { OpenAIAgent } from '../../src/agents/openai.js';

// Mock all integrations
jest.mock('../../src/integrations/github.js');
jest.mock('../../src/integrations/jira.js');
jest.mock('../../src/integrations/slack.js');
jest.mock('../../src/agents/openai.js');

describe('WorkflowOrchestrator', () => {
  let orchestrator: WorkflowOrchestrator;
  let mockGitHub: jest.Mocked<GitHubIntegration>;
  let mockJira: jest.Mocked<JiraIntegration>;
  let mockSlack: jest.Mocked<SlackIntegration>;
  let mockAI: jest.Mocked<OpenAIAgent>;

  beforeEach(() => {
    mockGitHub = {
      getPRDetails: jest.fn(),
      getRepositoryStats: jest.fn(),
      updatePRStatus: jest.fn(),
      createRelease: jest.fn(),
    } as any;

    mockJira = {
      getIssue: jest.fn(),
      addCommentToIssue: jest.fn(),
      searchIssues: jest.fn(),
      getProjectIssueStats: jest.fn(),
    } as any;

    mockSlack = {
      findChannelByName: jest.fn(),
      sendNotification: jest.fn(),
    } as any;

    mockAI = {
      analyzePullRequest: jest.fn(),
      triageIssue: jest.fn(),
      assessReleaseReadiness: jest.fn(),
      generateTeamInsights: jest.fn(),
    } as any;

    orchestrator = new WorkflowOrchestrator({
      github: mockGitHub,
      jira: mockJira,
      slack: mockSlack,
      ai: mockAI,
    });
  });

  describe('analyzePR', () => {
    it('should analyze PR successfully', async () => {
      const mockPRDetails = {
        number: 123,
        title: 'Feature: Add new functionality',
        body: 'Implements PROJ-456',
        state: 'open',
        author: 'developer',
        createdAt: '2023-01-01T00:00:00Z',
        changedFiles: 3,
        additions: 100,
        deletions: 50,
        files: [
          { filename: 'src/feature.ts', status: 'added', additions: 80, deletions: 0, changes: 80 }
        ],
        commits: [
          { sha: 'abc123', message: 'Add feature', author: 'developer' }
        ],
        reviews: [
          { user: 'reviewer', state: 'APPROVED', submittedAt: '2023-01-02T00:00:00Z' }
        ]
      };

      const mockAIAnalysis = {
        analysis: 'This PR introduces a new feature with moderate complexity.',
        confidence: 85,
        recommendations: ['Review the error handling', 'Add more tests'],
        structuredData: {
          suggestedReviewers: ['senior-dev', 'team-lead'],
          riskLevel: 'medium',
          estimatedReviewTime: 3,
          topics: ['feature', 'backend'],
        }
      };

      const mockRepoStats = {
        commits: 50,
        pullRequests: 10,
        issues: 5,
        contributors: ['developer', 'senior-dev', 'team-lead'],
        languages: { TypeScript: 80, JavaScript: 20 }
      };

      mockGitHub.getPRDetails.mockResolvedValue(mockPRDetails);
      mockGitHub.getRepositoryStats.mockResolvedValue(mockRepoStats);
      mockAI.analyzePullRequest.mockResolvedValue(mockAIAnalysis);

      const result = await orchestrator.analyzePR({
        owner: 'testorg',
        repo: 'testrepo',
        pull_number: 123,
        include_jira_context: true
      });

      expect(result).toMatchObject({
        summary: 'This PR introduces a new feature with moderate complexity.',
        suggestedReviewers: ['senior-dev', 'team-lead'],
        riskLevel: 'medium',
        estimatedReviewTime: 3,
        topics: ['feature', 'backend'],
        relatedJiraTickets: ['PROJ-456']
      });

      expect(mockGitHub.getPRDetails).toHaveBeenCalledWith('testorg', 'testrepo', 123);
      expect(mockAI.analyzePullRequest).toHaveBeenCalled();
    });

    it('should handle analysis failure gracefully', async () => {
      mockGitHub.getPRDetails.mockRejectedValue(new Error('GitHub API error'));

      await expect(orchestrator.analyzePR({
        owner: 'testorg',
        repo: 'testrepo',
        pull_number: 123
      })).rejects.toThrow('GitHub API error');
    });
  });

  describe('smartTriage', () => {
    it('should triage issue successfully', async () => {
      const mockJiraIssue = {
        key: 'PROJ-789',
        id: '123',
        summary: 'Critical bug in payment system',
        description: 'Payment processing fails intermittently',
        issueType: 'Bug',
        status: 'Open',
        priority: 'High',
        assignee: undefined,
        reporter: 'user@example.com',
        created: '2023-01-01T00:00:00Z',
        updated: '2023-01-01T00:00:00Z',
        labels: ['payment', 'critical'],
        components: ['backend'],
        fixVersions: [],
        sprint: undefined,
        storyPoints: undefined,
        customFields: {},
        comments: [
          { author: 'developer', body: 'Investigating the issue', created: '2023-01-01T12:00:00Z' }
        ],
        worklog: []
      };

      const mockAIAnalysis = {
        analysis: 'This is a critical payment system bug that requires immediate attention.',
        confidence: 95,
        recommendations: ['Assign to senior backend developer', 'Add to current sprint'],
        structuredData: {
          priority: 'critical',
          category: 'bug',
          estimatedEffort: 8,
          suggestedAssignee: 'backend-lead',
          dependencies: [],
          tags: ['urgent', 'payment']
        }
      };

      mockJira.getIssue.mockResolvedValue(mockJiraIssue);
      mockJira.searchIssues.mockResolvedValue([]);
      mockAI.triageIssue.mockResolvedValue(mockAIAnalysis);
      mockJira.addCommentToIssue.mockResolvedValue();

      const result = await orchestrator.smartTriage({
        issue_key: 'PROJ-789',
        team_context: 'backend-team'
      });

      expect(result).toMatchObject({
        priority: 'critical',
        category: 'bug',
        estimatedEffort: 8,
        suggestedAssignee: 'backend-lead',
        dependencies: [],
        tags: ['urgent', 'payment']
      });

      expect(mockJira.getIssue).toHaveBeenCalledWith('PROJ-789');
      expect(mockJira.addCommentToIssue).toHaveBeenCalledWith(
        'PROJ-789',
        expect.stringContaining('🤖 IDWO Smart Triage Analysis')
      );
    });
  });

  describe('orchestrateRelease', () => {
    it('should orchestrate release successfully', async () => {
      const mockRepoStats = {
        commits: 25,
        pullRequests: 5,
        issues: 2,
        contributors: ['dev1', 'dev2'],
        languages: { TypeScript: 100 }
      };

      const mockJiraStats = {
        totalIssues: 10,
        byStatus: { 'Done': 8, 'Open': 2 },
        byPriority: { 'High': 2, 'Medium': 6, 'Low': 2 },
        byAssignee: { 'dev1': 5, 'dev2': 3, 'Unassigned': 2 },
        completedInPeriod: 8,
        createdInPeriod: 3
      };

      const mockSlackChannel = {
        id: 'C123456',
        name: 'releases',
        isChannel: true,
        isGroup: false,
        isIm: false,
        isMember: true,
        isPrivate: false
      };

      const mockAIAnalysis = {
        analysis: 'Release readiness assessment shows good overall health.',
        confidence: 80,
        recommendations: ['Run final integration tests', 'Update documentation'],
        structuredData: {
          readinessScore: 85,
          blockers: [],
          riskLevel: 'low'
        }
      };

      mockGitHub.getRepositoryStats.mockResolvedValue(mockRepoStats);
      mockJira.getProjectIssueStats.mockResolvedValue(mockJiraStats);
      mockJira.searchIssues.mockResolvedValue([]);
      mockSlack.findChannelByName.mockResolvedValue(mockSlackChannel);
      mockAI.assessReleaseReadiness.mockResolvedValue(mockAIAnalysis);
      mockSlack.sendNotification.mockResolvedValue({
        ts: '1234567890.123',
        channel: 'C123456',
        message: { text: 'Release notification', user: 'bot', ts: '1234567890.123' }
      });

      const result = await orchestrator.orchestrateRelease({
        release_version: 'v2.1.0',
        repository: 'testorg/testrepo',
        jira_project: 'PROJ',
        slack_channel: '#releases',
        dry_run: true
      });

      expect(result).toMatchObject({
        readiness: 85,
        blockers: [],
        testCoverage: 0,
        openIssues: 10,
        recommendation: 'proceed'
      });

      expect(mockSlack.sendNotification).toHaveBeenCalledWith(
        'C123456',
        expect.objectContaining({
          title: '🚀 Release v2.1.0 Analysis',
          color: 'good'
        })
      );
    });

    it('should handle missing Slack channel', async () => {
      mockGitHub.getRepositoryStats.mockResolvedValue({} as any);
      mockJira.getProjectIssueStats.mockResolvedValue({} as any);
      mockSlack.findChannelByName.mockResolvedValue(null);

      await expect(orchestrator.orchestrateRelease({
        release_version: 'v1.0.0',
        repository: 'test/repo',
        jira_project: 'PROJ',
        slack_channel: '#nonexistent'
      })).rejects.toThrow('Slack channel #nonexistent not found');
    });
  });

  describe('syncWorkflowStatus', () => {
    it('should sync status across platforms', async () => {
      // First create a workflow status
      const mockPRDetails = {
        number: 123,
        title: 'Test PR',
        body: '',
        state: 'open',
        author: 'developer',
        createdAt: '2023-01-01T00:00:00Z',
        changedFiles: 1,
        additions: 10,
        deletions: 5,
        files: [],
        commits: [],
        reviews: []
      };

      mockGitHub.getPRDetails.mockResolvedValue(mockPRDetails);
      mockGitHub.getRepositoryStats.mockResolvedValue({ contributors: [] } as any);
      mockAI.analyzePullRequest.mockResolvedValue({
        analysis: 'Test analysis',
        confidence: 80,
        recommendations: []
      });

      // Analyze PR to create workflow state
      await orchestrator.analyzePR({
        owner: 'testorg',
        repo: 'testrepo',
        pull_number: 123
      });

      // Mock platform update methods
      mockGitHub.updatePRStatus.mockResolvedValue();
      mockJira.addCommentToIssue.mockResolvedValue();
      mockSlack.sendNotification.mockResolvedValue({
        ts: '123456789',
        channel: 'C123456',
        message: { text: 'Status update', user: 'bot', ts: '123456789' }
      });

      const result = await orchestrator.syncWorkflowStatus({
        workflow_id: 'pr-testorg-testrepo-123',
        status_update: 'in-review',
        platforms: ['github', 'slack']
      });

      expect(result.status).toBe('in-review');
      expect(result.services.github?.status).toBe('in-review');
    });
  });

  describe('getTeamInsights', () => {
    it('should generate team insights successfully', async () => {
      const mockAIAnalysis = {
        analysis: 'Team performance analysis shows consistent velocity with some bottlenecks in code review.',
        confidence: 75,
        recommendations: ['Implement review time SLAs', 'Add more senior reviewers'],
        structuredData: {
          velocityTrend: 'stable',
          bottlenecks: [
            { type: 'review', description: 'Code review delays', impact: 3 }
          ],
          teamMetrics: {
            avgPRSize: 150,
            avgReviewTime: 24,
            deploymentFrequency: 2,
            cycleTime: 72
          }
        }
      };

      mockAI.generateTeamInsights.mockResolvedValue(mockAIAnalysis);

      const result = await orchestrator.getTeamInsights({
        team_name: 'backend-team',
        time_period: '30d',
        include_predictions: true
      });

      expect(result).toMatchObject({
        velocity: {
          trend: 'stable'
        },
        bottlenecks: [
          { type: 'review', description: 'Code review delays', impact: 3 }
        ],
        teamMetrics: {
          avgPRSize: 150,
          avgReviewTime: 24,
          deploymentFrequency: 2,
          cycleTime: 72
        }
      });

      expect(mockAI.generateTeamInsights).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'backend-team',
          period: '30d'
        })
      );
    });
  });
});