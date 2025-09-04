#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { config, validateConfig } from './config/index.js';
import logger from './utils/logger.js';
import { GitHubIntegration } from './integrations/github.js';
import { JiraIntegration } from './integrations/jira.js';
import { SlackIntegration } from './integrations/slack.js';
import { OpenAIAgent } from './agents/openai.js';
import { WorkflowOrchestrator } from './workflows/orchestrator.js';

class IDWOMCPServer {
  private server: Server;
  private githubIntegration: GitHubIntegration;
  private jiraIntegration: JiraIntegration;
  private slackIntegration: SlackIntegration;
  private openAIAgent: OpenAIAgent;
  private workflowOrchestrator: WorkflowOrchestrator;

  constructor() {
    this.server = new Server(
      {
        name: 'idwo-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.githubIntegration = new GitHubIntegration(config.github);
    this.jiraIntegration = new JiraIntegration(config.jira);
    this.slackIntegration = new SlackIntegration(config.slack);
    this.openAIAgent = new OpenAIAgent(config.openai);
    this.workflowOrchestrator = new WorkflowOrchestrator({
      github: this.githubIntegration,
      jira: this.jiraIntegration,
      slack: this.slackIntegration,
      ai: this.openAIAgent,
    });

    this.setupTools();
    this.setupErrorHandling();
  }

  private setupTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'analyze_pr',
            description: 'Analyze a pull request and provide intelligent insights including suggested reviewers, risk assessment, and related JIRA tickets',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'GitHub repository owner' },
                repo: { type: 'string', description: 'GitHub repository name' },
                pull_number: { type: 'number', description: 'Pull request number' },
                include_jira_context: { type: 'boolean', description: 'Whether to analyze JIRA ticket context', default: true },
              },
              required: ['owner', 'repo', 'pull_number'],
            },
          },
          {
            name: 'smart_triage',
            description: 'Automatically triage and categorize issues using AI analysis, suggesting priority, assignee, and sprint placement',
            inputSchema: {
              type: 'object',
              properties: {
                issue_key: { type: 'string', description: 'JIRA issue key (e.g., PROJ-123)' },
                github_issue_url: { type: 'string', description: 'GitHub issue URL for additional context' },
                team_context: { type: 'string', description: 'Team or component context' },
              },
              required: ['issue_key'],
            },
          },
          {
            name: 'orchestrate_release',
            description: 'Orchestrate a release across GitHub, JIRA, and Slack with intelligent readiness assessment',
            inputSchema: {
              type: 'object',
              properties: {
                release_version: { type: 'string', description: 'Release version (e.g., v1.2.3)' },
                repository: { type: 'string', description: 'Repository in format owner/repo' },
                jira_project: { type: 'string', description: 'JIRA project key' },
                slack_channel: { type: 'string', description: 'Slack channel for notifications' },
                dry_run: { type: 'boolean', description: 'Whether to perform a dry run', default: false },
              },
              required: ['release_version', 'repository', 'jira_project', 'slack_channel'],
            },
          },
          {
            name: 'sync_workflow_status',
            description: 'Synchronize workflow status across GitHub, JIRA, and Slack platforms',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_id: { type: 'string', description: 'Unique workflow identifier' },
                status_update: { type: 'string', description: 'New status to sync across platforms' },
                platforms: { 
                  type: 'array', 
                  items: { type: 'string', enum: ['github', 'jira', 'slack'] },
                  description: 'Platforms to sync status to',
                  default: ['github', 'jira', 'slack']
                },
              },
              required: ['workflow_id', 'status_update'],
            },
          },
          {
            name: 'get_team_insights',
            description: 'Generate team productivity insights and identify workflow bottlenecks using AI analysis',
            inputSchema: {
              type: 'object',
              properties: {
                team_name: { type: 'string', description: 'Team identifier or name' },
                time_period: { type: 'string', description: 'Analysis period (e.g., "30d", "1w", "1q")', default: '30d' },
                include_predictions: { type: 'boolean', description: 'Include predictive analytics', default: true },
              },
              required: ['team_name'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'analyze_pr':
            return await this.handleAnalyzePR(args);
          case 'smart_triage':
            return await this.handleSmartTriage(args);
          case 'orchestrate_release':
            return await this.handleOrchestrateRelease(args);
          case 'sync_workflow_status':
            return await this.handleSyncWorkflowStatus(args);
          case 'get_team_insights':
            return await this.handleGetTeamInsights(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
        }
      } catch (error) {
        logger.error('Tool execution error', { tool: name, error: error instanceof Error ? error.message : 'Unknown error', args });
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private async handleAnalyzePR(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
    const schema = z.object({
      owner: z.string(),
      repo: z.string(),
      pull_number: z.number(),
      include_jira_context: z.boolean().default(true),
    });

    const params = schema.parse(args);
    const result = await this.workflowOrchestrator.analyzePR(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleSmartTriage(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
    const schema = z.object({
      issue_key: z.string(),
      github_issue_url: z.string().optional(),
      team_context: z.string().optional(),
    });

    const params = schema.parse(args);
    const result = await this.workflowOrchestrator.smartTriage(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleOrchestrateRelease(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
    const schema = z.object({
      release_version: z.string(),
      repository: z.string(),
      jira_project: z.string(),
      slack_channel: z.string(),
      dry_run: z.boolean().default(false),
    });

    const params = schema.parse(args);
    const result = await this.workflowOrchestrator.orchestrateRelease(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleSyncWorkflowStatus(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
    const schema = z.object({
      workflow_id: z.string(),
      status_update: z.string(),
      platforms: z.array(z.enum(['github', 'jira', 'slack'])).default(['github', 'jira', 'slack']),
    });

    const params = schema.parse(args);
    const result = await this.workflowOrchestrator.syncWorkflowStatus(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handleGetTeamInsights(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
    const schema = z.object({
      team_name: z.string(),
      time_period: z.string().default('30d'),
      include_predictions: z.boolean().default(true),
    });

    const params = schema.parse(args);
    const result = await this.workflowOrchestrator.getTeamInsights(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error('MCP Server error', error);
    };

    process.on('SIGINT', async () => {
      logger.info('Shutting down IDWO MCP Server...');
      await this.server.close();
      process.exit(0);
    });
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('IDWO MCP Server started successfully');
  }
}

async function main(): Promise<void> {
  try {
    validateConfig();
    const server = new IDWOMCPServer();
    await server.start();
  } catch (error) {
    logger.error('Failed to start IDWO MCP Server', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Unhandled error in main', error);
    process.exit(1);
  });
}