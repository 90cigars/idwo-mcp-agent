# Claude Code Integration Example

This example demonstrates how to use IDWO with Claude Code for automating development workflows.

## Setup

1. **Configure MCP Client**
   
   Add to your Claude Code configuration:
   ```json
   {
     "mcpServers": {
       "idwo": {
         "command": "node",
         "args": ["./dist/server.js"],
         "cwd": "/path/to/idwo-mcp-server",
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

2. **Environment Configuration**
   
   Ensure your `.env` file is properly configured with API keys.

## Example Workflows

### 1. Automated PR Analysis

```
User: Analyze pull request #142 in the frontend-app repository

Claude: I'll analyze that pull request for you using the IDWO system.
```

**MCP Tool Call:**
```json
{
  "tool": "analyze_pr",
  "arguments": {
    "owner": "your-org",
    "repo": "frontend-app", 
    "pull_number": 142,
    "include_jira_context": true
  }
}
```

**Expected Response:**
```json
{
  "summary": "This PR introduces a new user authentication flow with OAuth 2.0 integration. The changes span across 8 files with moderate complexity.",
  "suggestedReviewers": ["senior-frontend-dev", "security-lead"],
  "riskLevel": "medium",
  "estimatedReviewTime": 3,
  "topics": ["authentication", "frontend", "security"],
  "relatedJiraTickets": ["AUTH-456", "SEC-123"]
}
```

**Claude's Response:**
> ## PR Analysis Results
> 
> **Risk Level:** Medium
> **Estimated Review Time:** 3 hours
> 
> **Summary:** This PR introduces a new user authentication flow with OAuth 2.0 integration. The changes span across 8 files with moderate complexity.
> 
> **Suggested Reviewers:**
> - senior-frontend-dev (authentication expertise)
> - security-lead (security review required)
> 
> **Related JIRA Tickets:**
> - AUTH-456: Implement OAuth 2.0 authentication
> - SEC-123: Security audit for authentication flow
> 
> **Key Areas for Review:**
> - OAuth token handling and storage
> - Error handling for authentication failures
> - Security implications of the authentication flow

### 2. Smart Issue Triage

```
User: Triage JIRA issue PROJ-789 for the backend team

Claude: I'll analyze and triage this issue using our intelligent system.
```

**MCP Tool Call:**
```json
{
  "tool": "smart_triage",
  "arguments": {
    "issue_key": "PROJ-789",
    "team_context": "backend-team"
  }
}
```

**Expected Response:**
```json
{
  "priority": "high",
  "category": "bug",
  "estimatedEffort": 5,
  "suggestedAssignee": "backend-senior-dev",
  "suggestedSprint": "Sprint 24",
  "dependencies": ["PROJ-788"],
  "tags": ["database", "performance", "urgent"]
}
```

**Claude's Response:**
> ## Issue Triage Results
> 
> **Issue:** PROJ-789 - Database performance degradation
> 
> **Recommended Priority:** High
> **Category:** Bug
> **Estimated Effort:** 5 story points
> 
> **Assignment Recommendation:**
> - **Assignee:** backend-senior-dev (database expertise)
> - **Sprint:** Sprint 24 (current sprint)
> 
> **Dependencies:**
> - PROJ-788 (database schema update) must be completed first
> 
> **Tags:** database, performance, urgent
> 
> I've automatically added a comment to the JIRA issue with this analysis.

### 3. Release Orchestration

```
User: Prepare release v2.1.0 for the main-app repository and notify the #releases channel

Claude: I'll orchestrate the release process and assess readiness.
```

**MCP Tool Call:**
```json
{
  "tool": "orchestrate_release",
  "arguments": {
    "release_version": "v2.1.0",
    "repository": "your-org/main-app",
    "jira_project": "MAIN",
    "slack_channel": "#releases",
    "dry_run": false
  }
}
```

**Expected Response:**
```json
{
  "readiness": 85,
  "blockers": [
    {
      "type": "testing",
      "description": "Integration tests failing for payment module",
      "severity": "medium"
    }
  ],
  "testCoverage": 78,
  "openIssues": 3,
  "recommendation": "caution",
  "suggestedActions": [
    "Fix failing integration tests",
    "Review open critical issues",
    "Update release notes"
  ]
}
```

**Claude's Response:**
> ## Release v2.1.0 Readiness Assessment
> 
> **Overall Readiness:** 85% ⚠️
> **Recommendation:** Proceed with Caution
> 
> **Current Status:**
> - Test Coverage: 78%
> - Open Issues: 3
> - Critical Blockers: 1
> 
> **Blockers to Address:**
> - ⚠️ Integration tests failing for payment module (Medium severity)
> 
> **Suggested Actions Before Release:**
> 1. Fix failing integration tests
> 2. Review open critical issues  
> 3. Update release notes
> 
> **Next Steps:**
> - The #releases Slack channel has been notified
> - Release is in draft mode pending blocker resolution
> - Consider releasing after addressing the payment module test failures

### 4. Team Insights

```
User: Generate insights for the backend team for the last 30 days

Claude: I'll analyze the backend team's performance and identify areas for improvement.
```

**MCP Tool Call:**
```json
{
  "tool": "get_team_insights", 
  "arguments": {
    "team_name": "backend-team",
    "time_period": "30d",
    "include_predictions": true
  }
}
```

**Expected Response:**
```json
{
  "velocity": {
    "current": 42,
    "historical": [38, 35, 40, 42, 39],
    "trend": "increasing"
  },
  "bottlenecks": [
    {
      "type": "review",
      "description": "Code review process delays averaging 2.3 days",
      "impact": 4
    },
    {
      "type": "testing", 
      "description": "Manual testing bottleneck in QA pipeline",
      "impact": 3
    }
  ],
  "teamMetrics": {
    "avgPRSize": 185,
    "avgReviewTime": 55,
    "deploymentFrequency": 8,
    "cycleTime": 96
  }
}
```

**Claude's Response:**
> ## Backend Team Insights (Last 30 Days)
> 
> ### 📈 Velocity Trends
> - **Current Sprint:** 42 story points
> - **Trend:** Increasing (+7% over 3 sprints)
> - **Historical Range:** 35-42 points
> 
> ### ⚠️ Identified Bottlenecks
> 
> **1. Code Review Delays (High Impact)**
> - Average review time: 2.3 days
> - Impact score: 4/5
> - **Recommendation:** Implement review time SLAs and add senior reviewers
> 
> **2. Manual Testing Pipeline (Medium Impact)**  
> - QA bottleneck in testing process
> - Impact score: 3/5
> - **Recommendation:** Increase test automation coverage
> 
> ### 📊 Key Metrics
> - **Average PR Size:** 185 lines (target: <150)
> - **Review Time:** 55 hours (target: <24)
> - **Deployment Frequency:** 8 per sprint (excellent)
> - **Cycle Time:** 96 hours (target: <72)
> 
> ### 🎯 Recommendations
> 1. Break down large PRs to reduce review burden
> 2. Implement automated review assignment
> 3. Increase test automation to reduce manual QA time
> 4. Consider pair programming for complex features

### 5. Workflow Status Synchronization

```
User: Update the status of workflow pr-your-org-main-app-156 to "ready-for-deployment" across all platforms

Claude: I'll synchronize that status update across GitHub, JIRA, and Slack.
```

**MCP Tool Call:**
```json
{
  "tool": "sync_workflow_status",
  "arguments": {
    "workflow_id": "pr-your-org-main-app-156", 
    "status_update": "ready-for-deployment",
    "platforms": ["github", "jira", "slack"]
  }
}
```

**Expected Response:**
```json
{
  "id": "pr-your-org-main-app-156",
  "type": "pr",
  "status": "ready-for-deployment", 
  "lastUpdated": "2025-01-15T10:30:00Z",
  "services": {
    "github": {
      "status": "ready-for-deployment",
      "url": "https://github.com/your-org/main-app/pull/156"
    },
    "jira": {
      "status": "ready-for-deployment", 
      "key": "MAIN-456"
    },
    "slack": {
      "channel": "#dev-notifications",
      "messageId": "1234567890.123"
    }
  }
}
```

**Claude's Response:**
> ## Workflow Status Updated ✅
> 
> **Workflow:** pr-your-org-main-app-156
> **New Status:** ready-for-deployment
> **Updated:** 2025-01-15 10:30 AM
> 
> **Platform Updates:**
> - ✅ **GitHub:** PR status updated with deployment ready label
> - ✅ **JIRA:** Comment added to MAIN-456 with status update  
> - ✅ **Slack:** Notification sent to #dev-notifications channel
> 
> All platforms have been successfully synchronized with the new status.

## Advanced Usage Patterns

### Chained Workflows

```
User: Analyze PR #158, then if it's low risk, update its status to approved and notify the team

Claude: I'll analyze the PR first and then proceed based on the risk assessment.

[Performs analyze_pr tool call]

Based on the analysis showing low risk (confidence: 92%), I'll now update the status and notify the team.

[Performs sync_workflow_status tool call]

The PR has been marked as approved and the team has been notified via Slack.
```

### Conditional Logic

```
User: Check if release v1.5.0 is ready, and only create it if readiness score is above 90%

Claude: I'll assess the release readiness first and then decide whether to proceed.

[Performs orchestrate_release with dry_run: true]

The readiness score is 87%, which is below your 90% threshold. I recommend addressing the identified blockers before proceeding with the release.
```

## Best Practices

### 1. **Error Handling**
Always handle potential failures gracefully:
```
User: Analyze PR #999 in nonexistent-repo

Claude: I encountered an error while trying to analyze that PR:
- Repository "nonexistent-repo" was not found
- Please verify the repository name and your access permissions
```

### 2. **Context Awareness**
Provide relevant context in requests:
```
User: Triage the payment gateway issue for the payments team with high priority context

Claude: I'll triage the issue with payments team context and prioritize accordingly.
```

### 3. **Batch Operations**
Group related operations when possible:
```
User: Analyze PRs #100, #101, and #102, then generate team insights

Claude: I'll analyze all three PRs and then provide team insights based on the recent activity.
```

This integration demonstrates how IDWO provides intelligent automation capabilities that understand context and make informed decisions, making it a powerful tool for principal engineers managing complex development workflows.