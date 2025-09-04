#!/usr/bin/env node

import dotenv from 'dotenv';
import { GitHubIntegration } from '../dist/integrations/github.js';
import { JiraIntegration } from '../dist/integrations/jira.js';
import { SlackIntegration } from '../dist/integrations/slack.js';
import { OpenAIAgent } from '../dist/agents/openai.js';

dotenv.config();

async function testAPIs() {
  console.log('🧪 Testing API Integrations...\n');

  // Test GitHub
  try {
    console.log('Testing GitHub API...');
    const github = new GitHubIntegration({
      token: process.env.GITHUB_TOKEN,
      organization: process.env.GITHUB_ORGANIZATION
    });
    
    // Test with a public repo (change as needed)
    const stats = await github.getRepositoryStats('octocat', 'Hello-World');
    console.log('✅ GitHub API working - Contributors:', stats.contributors.length);
  } catch (error) {
    console.log('❌ GitHub API error:', error.message);
  }

  // Test JIRA
  try {
    console.log('\nTesting JIRA API...');
    const jira = new JiraIntegration({
      url: process.env.JIRA_URL,
      username: process.env.JIRA_USERNAME,
      apiToken: process.env.JIRA_API_TOKEN
    });
    
    // Test project access (change project key as needed)
    const project = await jira.getProject('TEST');
    console.log('✅ JIRA API working - Project:', project.name);
  } catch (error) {
    console.log('❌ JIRA API error:', error.message);
  }

  // Test Slack
  try {
    console.log('\nTesting Slack API...');
    const slack = new SlackIntegration({
      botToken: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET
    });
    
    const channel = await slack.findChannelByName('general');
    console.log('✅ Slack API working - Found channel:', channel?.name || 'none');
  } catch (error) {
    console.log('❌ Slack API error:', error.message);
  }

  // Test OpenAI
  try {
    console.log('\nTesting OpenAI API...');
    const ai = new OpenAIAgent({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
    });
    
    const result = await ai.analyzeContext({
      type: 'pr_analysis',
      context: { title: 'Test PR', description: 'Simple test' },
      instructions: 'Provide a brief analysis of this test PR.'
    });
    
    console.log('✅ OpenAI API working - Confidence:', result.confidence);
  } catch (error) {
    console.log('❌ OpenAI API error:', error.message);
  }

  console.log('\n🏁 API Testing Complete!');
}

testAPIs().catch(console.error);