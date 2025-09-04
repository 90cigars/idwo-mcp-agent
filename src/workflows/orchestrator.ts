import logger from '../utils/logger.js';
import { GitHubIntegration } from '../integrations/github.js';
import { JiraIntegration } from '../integrations/jira.js';
import { SlackIntegration } from '../integrations/slack.js';
import { OpenAIAgent } from '../agents/openai.js';
import { 
  PRAnalysisResult, 
  IssueTriageResult, 
  WorkflowStatus, 
  ReleaseAnalysis, 
  TeamInsights, 
  ServiceError 
} from '../types/index.js';

export interface WorkflowDependencies {
  github: GitHubIntegration;
  jira: JiraIntegration;
  slack: SlackIntegration;
  ai: OpenAIAgent;
}

export interface PRAnalysisParams {
  owner: string;
  repo: string;
  pull_number: number;
  include_jira_context?: boolean;
}

export interface SmartTriageParams {
  issue_key: string;
  github_issue_url?: string;
  team_context?: string;
}

export interface ReleaseOrchestrationParams {
  release_version: string;
  repository: string;
  jira_project: string;
  slack_channel: string;
  dry_run?: boolean;
}

export interface WorkflowStatusParams {
  workflow_id: string;
  status_update: string;
  platforms?: ('github' | 'jira' | 'slack')[];
}

export interface TeamInsightsParams {
  team_name: string;
  time_period?: string;
  include_predictions?: boolean;
}

export class WorkflowOrchestrator {
  private github: GitHubIntegration;
  private jira: JiraIntegration;
  private slack: SlackIntegration;
  private ai: OpenAIAgent;
  private workflowState: Map<string, WorkflowStatus> = new Map();

  constructor(dependencies: WorkflowDependencies) {
    this.github = dependencies.github;
    this.jira = dependencies.jira;
    this.slack = dependencies.slack;
    this.ai = dependencies.ai;
  }

  async analyzePR(params: PRAnalysisParams): Promise<PRAnalysisResult> {
    const workflowId = `pr-${params.owner}-${params.repo}-${params.pull_number}`;
    
    try {
      logger.info('Starting PR analysis', { workflowId, params });

      this.updateWorkflowStatus(workflowId, {
        id: workflowId,
        type: 'pr',
        status: 'analyzing',
        lastUpdated: new Date(),
        services: {},
      });

      const prDetails = await this.github.getPRDetails(params.owner, params.repo, params.pull_number);

      let jiraContext = null;
      if (params.include_jira_context) {
        jiraContext = await this.extractJiraContext(prDetails.title, prDetails.body);
      }

      const teamMembers = await this.getTeamMembers(params.owner, params.repo);

      const aiAnalysis = await this.ai.analyzePullRequest({
        title: prDetails.title,
        description: prDetails.body,
        files: prDetails.files,
        commits: prDetails.commits,
        reviews: prDetails.reviews,
        teamMembers,
      });

      const result: PRAnalysisResult = {
        summary: aiAnalysis.analysis,
        suggestedReviewers: aiAnalysis.structuredData?.suggestedReviewers || [],
        riskLevel: aiAnalysis.structuredData?.riskLevel || 'medium',
        estimatedReviewTime: aiAnalysis.structuredData?.estimatedReviewTime || 2,
        topics: aiAnalysis.structuredData?.topics || [],
        relatedJiraTickets: jiraContext?.tickets || [],
      };

      this.updateWorkflowStatus(workflowId, {
        id: workflowId,
        type: 'pr',
        status: 'completed',
        lastUpdated: new Date(),
        services: {
          github: { 
            status: 'analyzed', 
            url: `https://github.com/${params.owner}/${params.repo}/pull/${params.pull_number}` 
          },
        },
      });

      logger.info('PR analysis completed', { workflowId, riskLevel: result.riskLevel, reviewersCount: result.suggestedReviewers.length });
      return result;

    } catch (error) {
      logger.error('PR analysis failed', { workflowId, error });
      this.updateWorkflowStatus(workflowId, {
        id: workflowId,
        type: 'pr',
        status: 'failed',
        lastUpdated: new Date(),
        services: {},
      });
      throw error;
    }
  }

  async smartTriage(params: SmartTriageParams): Promise<IssueTriageResult> {
    const workflowId = `triage-${params.issue_key}`;
    
    try {
      logger.info('Starting smart triage', { workflowId, params });

      this.updateWorkflowStatus(workflowId, {
        id: workflowId,
        type: 'issue',
        status: 'triaging',
        lastUpdated: new Date(),
        services: {},
      });

      const jiraIssue = await this.jira.getIssue(params.issue_key);

      let githubContext = null;
      if (params.github_issue_url) {
        githubContext = await this.extractGitHubIssueContext(params.github_issue_url);
      }

      const similarIssues = await this.findSimilarIssues(jiraIssue.summary, jiraIssue.description);

      const aiAnalysis = await this.ai.triageIssue({
        title: jiraIssue.summary,
        description: jiraIssue.description,
        labels: jiraIssue.labels,
        comments: jiraIssue.comments,
        reporter: jiraIssue.reporter,
        component: jiraIssue.components[0],
        teamContext: params.team_context,
        similarIssues,
      });

      const result: IssueTriageResult = {
        priority: aiAnalysis.structuredData?.priority || 'medium',
        category: aiAnalysis.structuredData?.category || 'story',
        estimatedEffort: aiAnalysis.structuredData?.estimatedEffort || 3,
        suggestedAssignee: aiAnalysis.structuredData?.suggestedAssignee,
        suggestedSprint: await this.getSuggestedSprint(params.issue_key),
        dependencies: aiAnalysis.structuredData?.dependencies || [],
        tags: aiAnalysis.structuredData?.tags || [],
      };

      await this.jira.addCommentToIssue(
        params.issue_key, 
        `🤖 IDWO Smart Triage Analysis:\n\n${aiAnalysis.analysis}\n\nRecommended Priority: ${result.priority}\nEstimated Effort: ${result.estimatedEffort} story points`
      );

      this.updateWorkflowStatus(workflowId, {
        id: workflowId,
        type: 'issue',
        status: 'completed',
        lastUpdated: new Date(),
        services: {
          jira: { status: 'triaged', key: params.issue_key },
        },
      });

      logger.info('Smart triage completed', { workflowId, priority: result.priority, effort: result.estimatedEffort });
      return result;

    } catch (error) {
      logger.error('Smart triage failed', { workflowId, error });
      this.updateWorkflowStatus(workflowId, {
        id: workflowId,
        type: 'issue',
        status: 'failed',
        lastUpdated: new Date(),
        services: {},
      });
      throw error;
    }
  }

  async orchestrateRelease(params: ReleaseOrchestrationParams): Promise<ReleaseAnalysis> {
    const workflowId = `release-${params.release_version}`;
    const repoParts = params.repository.split('/');
    const owner = repoParts[0];
    const repo = repoParts[1];
    
    if (!owner || !repo) {
      throw new Error('Invalid repository format. Expected "owner/repo"');
    }
    
    try {
      logger.info('Starting release orchestration', { workflowId, params });

      this.updateWorkflowStatus(workflowId, {
        id: workflowId,
        type: 'release',
        status: 'analyzing',
        lastUpdated: new Date(),
        services: {},
      });

      const [repoStats, jiraStats, slackChannel] = await Promise.all([
        this.github.getRepositoryStats(owner, repo),
        this.jira.getProjectIssueStats(params.jira_project),
        this.slack.findChannelByName(params.slack_channel),
      ]);

      if (!slackChannel) {
        throw new Error(`Slack channel ${params.slack_channel} not found`);
      }

      const releaseReadinessData = {
        version: params.release_version,
        commits: [], // Would be populated with actual commit data
        openIssues: await this.getBlockingIssues(params.jira_project),
        testResults: await this.getTestResults(owner, repo),
        deploymentHistory: await this.getDeploymentHistory(owner, repo),
        teamVelocity: { current: 0, historical: [] }, // Would be calculated from actual data
      };

      const aiAnalysis = await this.ai.assessReleaseReadiness(releaseReadinessData);

      const result: ReleaseAnalysis = {
        readiness: aiAnalysis.structuredData?.readinessScore || 70,
        blockers: aiAnalysis.structuredData?.blockers || [],
        testCoverage: releaseReadinessData.testResults?.coverage || 0,
        openIssues: jiraStats.totalIssues,
        recommendation: this.determineReleaseRecommendation(aiAnalysis.structuredData?.readinessScore || 70),
        suggestedActions: aiAnalysis.recommendations,
      };

      if (!params.dry_run && result.recommendation === 'proceed') {
        await this.executeRelease(params, result);
      }

      await this.slack.sendNotification(slackChannel.id, {
        title: `🚀 Release ${params.release_version} Analysis`,
        message: `Readiness Score: ${result.readiness}% - ${result.recommendation.toUpperCase()}`,
        color: result.recommendation === 'proceed' ? 'good' : result.recommendation === 'caution' ? 'warning' : 'danger',
        fields: [
          { title: 'Readiness Score', value: `${result.readiness}%`, short: true },
          { title: 'Test Coverage', value: `${result.testCoverage}%`, short: true },
          { title: 'Open Issues', value: result.openIssues.toString(), short: true },
          { title: 'Blockers', value: result.blockers.length.toString(), short: true },
        ],
      });

      this.updateWorkflowStatus(workflowId, {
        id: workflowId,
        type: 'release',
        status: 'completed',
        lastUpdated: new Date(),
        services: {
          github: { status: 'analyzed', url: `https://github.com/${params.repository}` },
          jira: { status: 'analyzed', key: params.jira_project },
          slack: { channel: slackChannel.id, messageId: 'notification-sent' },
        },
      });

      logger.info('Release orchestration completed', { workflowId, readiness: result.readiness, recommendation: result.recommendation });
      return result;

    } catch (error) {
      logger.error('Release orchestration failed', { workflowId, error });
      this.updateWorkflowStatus(workflowId, {
        id: workflowId,
        type: 'release',
        status: 'failed',
        lastUpdated: new Date(),
        services: {},
      });
      throw error;
    }
  }

  async syncWorkflowStatus(params: WorkflowStatusParams): Promise<WorkflowStatus> {
    try {
      logger.info('Syncing workflow status', params);

      const existingStatus = this.workflowState.get(params.workflow_id);
      if (!existingStatus) {
        throw new Error(`Workflow ${params.workflow_id} not found`);
      }

      const updatedStatus: WorkflowStatus = {
        ...existingStatus,
        status: params.status_update,
        lastUpdated: new Date(),
      };

      for (const platform of params.platforms || ['github', 'jira', 'slack']) {
        try {
          await this.updateStatusOnPlatform(platform, updatedStatus, params.status_update);
          const currentService = updatedStatus.services[platform];
          (updatedStatus.services as any)[platform] = { 
            status: params.status_update,
            ...currentService
          };
        } catch (error) {
          logger.warn(`Failed to sync status to ${platform}`, { workflowId: params.workflow_id, error });
        }
      }

      this.workflowState.set(params.workflow_id, updatedStatus);
      logger.info('Workflow status synced', { workflowId: params.workflow_id, status: params.status_update });
      return updatedStatus;

    } catch (error) {
      logger.error('Workflow status sync failed', { params, error });
      throw error;
    }
  }

  async getTeamInsights(params: TeamInsightsParams): Promise<TeamInsights> {
    try {
      logger.info('Generating team insights', params);

      const teamData = await this.gatherTeamData(params.team_name, params.time_period || '30d');

      const aiAnalysis = await this.ai.generateTeamInsights(teamData);

      const result: TeamInsights = {
        velocity: {
          current: teamData.velocity.current,
          historical: teamData.velocity.historical,
          trend: aiAnalysis.structuredData?.velocityTrend || 'stable',
        },
        bottlenecks: aiAnalysis.structuredData?.bottlenecks || [],
        teamMetrics: aiAnalysis.structuredData?.teamMetrics || {
          avgPRSize: 0,
          avgReviewTime: 0,
          deploymentFrequency: 0,
          cycleTime: 0,
        },
      };

      logger.info('Team insights generated', { 
        team: params.team_name, 
        velocityTrend: result.velocity.trend,
        bottlenecksCount: result.bottlenecks.length 
      });
      return result;

    } catch (error) {
      logger.error('Team insights generation failed', { params, error });
      throw error;
    }
  }

  private async extractJiraContext(title: string, body: string): Promise<{ tickets: string[] } | null> {
    try {
      const jiraKeyPattern = /([A-Z]+-\d+)/g;
      const matches = [...(title + ' ' + body).matchAll(jiraKeyPattern)];
      const tickets = [...new Set(matches.map(match => match[1]).filter((ticket): ticket is string => Boolean(ticket)))];
      
      return tickets.length > 0 ? { tickets } : null;
    } catch (error) {
      logger.warn('Failed to extract JIRA context', { error });
      return null;
    }
  }

  private async extractGitHubIssueContext(url: string): Promise<any> {
    try {
      const urlParts = url.split('/');
      const owner = urlParts[urlParts.length - 4];
      const repo = urlParts[urlParts.length - 3];
      const issueNumberStr = urlParts[urlParts.length - 1];
      if (!issueNumberStr) {
        throw new Error('Invalid GitHub issue URL');
      }
      const issueNumber = parseInt(issueNumberStr);
      
      if (!owner || !repo) {
        throw new Error('Invalid GitHub issue URL format');
      }
      return await this.github.getIssueDetails(owner, repo, issueNumber);
    } catch (error) {
      logger.warn('Failed to extract GitHub issue context', { url, error });
      return null;
    }
  }

  private async findSimilarIssues(title: string, description: string): Promise<Array<{ key: string; summary: string }>> {
    try {
      const keywords = this.extractKeywords(title + ' ' + description);
      const jql = `text ~ "${keywords.slice(0, 3).join(' OR ')}" ORDER BY created DESC`;
      const issues = await this.jira.searchIssues(jql, 5);
      
      return issues.map(issue => ({
        key: issue.key,
        summary: issue.summary,
      }));
    } catch (error) {
      logger.warn('Failed to find similar issues', { error });
      return [];
    }
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return words.filter(word => word.length > 3 && !stopWords.has(word)).slice(0, 10);
  }

  private async getTeamMembers(owner: string, repo: string): Promise<string[]> {
    try {
      const stats = await this.github.getRepositoryStats(owner, repo);
      return stats.contributors;
    } catch (error) {
      logger.warn('Failed to get team members', { owner, repo, error });
      return [];
    }
  }

  private async getSuggestedSprint(issueKey: string): Promise<string | undefined> {
    try {
      const issue = await this.jira.getIssue(issueKey);
      return issue.sprint || 'Next Sprint';
    } catch (error) {
      logger.warn('Failed to get suggested sprint', { issueKey, error });
      return undefined;
    }
  }

  private async getBlockingIssues(projectKey: string): Promise<Array<{ key: string; priority: string; summary: string }>> {
    try {
      const jql = `project = "${projectKey}" AND status NOT IN ("Done", "Closed") AND priority = "Highest"`;
      const issues = await this.jira.searchIssues(jql, 10);
      
      return issues.map(issue => ({
        key: issue.key,
        priority: issue.priority,
        summary: issue.summary,
      }));
    } catch (error) {
      logger.warn('Failed to get blocking issues', { projectKey, error });
      return [];
    }
  }

  private async getTestResults(owner: string, repo: string): Promise<{ passed: number; failed: number; coverage: number }> {
    return { passed: 0, failed: 0, coverage: 0 };
  }

  private async getDeploymentHistory(owner: string, repo: string): Promise<Array<{ version: string; success: boolean; date: string }>> {
    return [];
  }

  private determineReleaseRecommendation(readinessScore: number): 'proceed' | 'caution' | 'block' {
    if (readinessScore >= 85) return 'proceed';
    if (readinessScore >= 70) return 'caution';
    return 'block';
  }

  private async executeRelease(params: ReleaseOrchestrationParams, analysis: ReleaseAnalysis): Promise<void> {
    const repoParts = params.repository.split('/');
    const owner = repoParts[0];
    const repo = repoParts[1];
    
    if (!owner || !repo) {
      throw new Error('Invalid repository format. Expected "owner/repo"');
    }
    
    try {
      await this.github.createRelease(owner, repo, {
        tag_name: params.release_version,
        name: `Release ${params.release_version}`,
        body: `🤖 Automated release created by IDWO\n\nReadiness Score: ${analysis.readiness}%\n\nSuggested Actions:\n${analysis.suggestedActions.map(action => `- ${action}`).join('\n')}`,
        draft: analysis.recommendation !== 'proceed',
      });

      logger.info('Release created successfully', { version: params.release_version, repository: params.repository });
    } catch (error) {
      logger.error('Failed to execute release', { params, error });
      throw error;
    }
  }

  private async updateStatusOnPlatform(platform: string, status: WorkflowStatus, statusUpdate: string): Promise<void> {
    switch (platform) {
      case 'github':
        if (status.services.github?.url) {
          const urlParts = status.services.github.url.split('/');
          if (urlParts.includes('pull')) {
            const owner = urlParts[urlParts.length - 4];
            const repo = urlParts[urlParts.length - 3];
            const pullNumberStr = urlParts[urlParts.length - 1];
            if (!pullNumberStr) {
              throw new Error('Invalid GitHub PR URL');
            }
            const pullNumber = parseInt(pullNumberStr);
            if (!owner || !repo) {
              throw new Error('Invalid GitHub PR URL format');
            }
            await this.github.updatePRStatus(owner, repo, pullNumber, 'pending', `IDWO: ${statusUpdate}`);
          }
        }
        break;
      
      case 'jira':
        if (status.services.jira?.key) {
          await this.jira.addCommentToIssue(
            status.services.jira.key,
            `🤖 IDWO Status Update: ${statusUpdate}`
          );
        }
        break;
      
      case 'slack':
        if (status.services.slack?.channel) {
          await this.slack.sendNotification(status.services.slack.channel, {
            title: `🔄 Workflow Status Update`,
            message: `${status.type.toUpperCase()} ${status.id}: ${statusUpdate}`,
            color: statusUpdate.toLowerCase().includes('failed') ? 'danger' : 'good',
          });
        }
        break;
    }
  }

  private async gatherTeamData(teamName: string, period: string): Promise<any> {
    return {
      name: teamName,
      members: [],
      velocity: { current: 0, historical: [] },
      pullRequests: [],
      issues: [],
      deployments: [],
      period,
    };
  }

  private updateWorkflowStatus(workflowId: string, status: WorkflowStatus): void {
    this.workflowState.set(workflowId, status);
    logger.debug('Workflow status updated', { workflowId, status: status.status });
  }
}