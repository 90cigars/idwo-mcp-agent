#!/usr/bin/env node

import dotenv from 'dotenv';
import { WorkflowOrchestrator } from '../dist/workflows/orchestrator.js';
import { GitHubIntegration } from '../dist/integrations/github.js';
import { JiraIntegration } from '../dist/integrations/jira.js';
import { SlackIntegration } from '../dist/integrations/slack.js';
import { OpenAIAgent } from '../dist/agents/openai.js';

dotenv.config();

async function testMCPTools() {
  console.log('🛠️ Testing MCP Tools...\n');

  // Initialize orchestrator
  const orchestrator = new WorkflowOrchestrator({
    github: new GitHubIntegration({
      token: process.env.GITHUB_TOKEN,
      organization: process.env.GITHUB_ORGANIZATION
    }),
    jira: new JiraIntegration({
      url: process.env.JIRA_URL,
      username: process.env.JIRA_USERNAME,
      apiToken: process.env.JIRA_API_TOKEN
    }),
    slack: new SlackIntegration({
      botToken: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET
    }),
    ai: new OpenAIAgent({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
    })
  });

  // Test 1: Analyze PR (with public repo)
  try {
    console.log('Testing analyze_pr tool...');
    const prResult = await orchestrator.analyzePR({
      owner: 'octocat',
      repo: 'Hello-World',
      pull_number: 1, // Famous first PR
      include_jira_context: false
    });
    
    console.log('✅ analyze_pr working');
    console.log(`   Risk Level: ${prResult.riskLevel}`);
    console.log(`   Suggested Reviewers: ${prResult.suggestedReviewers.length}`);
  } catch (error) {
    console.log('❌ analyze_pr error:', error.message);
  }

  // Test 2: Smart Triage (if you have a JIRA issue)
  try {
    console.log('\nTesting smart_triage tool...');
    // Note: This requires a real JIRA issue key
    const issueKey = process.env.TEST_JIRA_ISSUE || 'TEST-1';
    
    const triageResult = await orchestrator.smartTriage({
      issue_key: issueKey,
      team_context: 'test-team'
    });
    
    console.log('✅ smart_triage working');
    console.log(`   Priority: ${triageResult.priority}`);
    console.log(`   Estimated Effort: ${triageResult.estimatedEffort}`);
  } catch (error) {
    console.log('❌ smart_triage error:', error.message);
  }

  // Test 3: Team Insights
  try {
    console.log('\nTesting get_team_insights tool...');
    const insights = await orchestrator.getTeamInsights({
      team_name: 'test-team',
      time_period: '30d',
      include_predictions: true
    });
    
    console.log('✅ get_team_insights working');
    console.log(`   Velocity Trend: ${insights.velocity.trend}`);
    console.log(`   Bottlenecks Found: ${insights.bottlenecks.length}`);
  } catch (error) {
    console.log('❌ get_team_insights error:', error.message);
  }

  console.log('\n🏁 MCP Tools Testing Complete!');
}

testMCPTools().catch(console.error);