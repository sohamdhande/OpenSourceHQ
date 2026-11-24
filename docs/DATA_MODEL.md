# Data Model and Prisma Implementation Guidance

Use PostgreSQL and Prisma. All IDs should be opaque strings (CUID/UUID). Use explicit enums. Include `createdAt` and `updatedAt` where applicable. Use soft deletion only where historical references must remain.

## Core entities

### User
- id
- name
- email (unique, normalized)
- emailVerifiedAt
- passwordHash (only if credentials auth is used)
- imageUrl
- timezone
- status: invited | active | suspended | deactivated
- createdAt, updatedAt

### Organization
- id
- name
- slug (unique)
- description
- logoUrl
- timezone
- settings JSON (validated by application schema)
- createdAt, updatedAt, archivedAt

### OrganizationMembership
- id
- organizationId
- userId
- role: ORG_ADMIN | MENTOR | MENTEE | OBSERVER
- status: invited | active | suspended | removed
- invitedById
- joinedAt
- unique(organizationId, userId)

### PlatformRole
Separate platform-level super-admin assignment from organization membership. Never infer super-admin from an organization role.

### Cohort
- id
- organizationId
- name
- slug
- description
- startDate, endDate
- timezone
- status: planned | active | completed | archived
- createdById
- createdAt, updatedAt

### CohortMentor
- id, cohortId, mentorId, assignedAt
- unique(cohortId, mentorId)

### CohortEnrollment
- id, cohortId, menteeId, status, enrolledAt, endedAt
- unique(cohortId, menteeId)

### DailyReport
- id, organizationId, cohortId, menteeId
- reportDate (date-only semantics; normalize consistently)
- workDone, learning, blockers, nextSteps
- hoursSpent nullable
- visibility: MENTORS_ONLY | COHORT
- status: DRAFT | SUBMITTED | REVIEWED | CHANGES_REQUESTED
- submittedAt, createdAt, updatedAt
- unique(cohortId, menteeId, reportDate)
- indexes(cohortId, reportDate), (menteeId, reportDate), (organizationId, status)

### ReportLink
- id, reportId, url, label, type
- validate URL schemes; allow https/http only.

### ReportReview
- id, reportId, reviewerId
- status: REVIEWED | CHANGES_REQUESTED
- comment
- createdAt
- preserve review history.

### Task
- id, organizationId, cohortId nullable
- title, description, priority, category
- createdById
- repositoryId nullable
- externalIssueUrl nullable
- dueAt nullable
- status for template/general task if needed
- createdAt, updatedAt, archivedAt

### TaskAssignment
- id, taskId, menteeId
- status: TODO | IN_PROGRESS | SUBMITTED | CHANGES_REQUESTED | COMPLETED | CANCELLED
- assignedById, assignedAt, completedAt
- unique(taskId, menteeId)

### TaskSubmission
- id, taskAssignmentId, submittedById
- notes, evidenceUrl nullable
- submittedAt
- reviewStatus and reviewer metadata if not normalized into TaskReview.

### TaskReview
- id, taskAssignmentId, reviewerId
- decision: ACCEPTED | CHANGES_REQUESTED
- comment, createdAt

### GitHubAccount
- id, userId
- providerUserId (GitHub numeric ID; unique)
- username, profileUrl, avatarUrl
- tokenCiphertext nullable; token encryption key comes from secret manager
- scopes JSON or normalized permissions metadata
- connectedAt, lastSyncedAt, connectionStatus
- unique(userId, providerUserId)

### GitHubInstallation
- id, organizationId
- providerInstallationId (unique)
- accountLogin, accountType
- permissions JSON
- installedAt, suspendedAt, lastSyncedAt

### Repository
- id, provider (GITHUB initially)
- providerRepositoryId (unique per provider)
- ownerLogin, name, fullName, url
- defaultBranch, visibility, description
- syncStatus, lastSyncedAt
- createdAt, updatedAt

### CohortRepository
- id, cohortId, repositoryId
- addedById, approvedAt, trackingEnabled
- unique(cohortId, repositoryId)

### RepositorySuggestion
- id, organizationId, cohortId, suggestedById
- url, note, status: PENDING | APPROVED | REJECTED
- reviewedById, reviewedAt

### GitHubActivity
- id, organizationId, repositoryId nullable, githubAccountId nullable
- providerEventId (nullable only when provider cannot supply one; otherwise unique)
- activityType: COMMIT | PULL_REQUEST_OPENED | PULL_REQUEST_MERGED | PULL_REQUEST_CLOSED | ISSUE_OPENED | ISSUE_CLOSED | REVIEW_SUBMITTED | COMMENT_CREATED | RELEASE_PUBLISHED
- title, summary nullable, url nullable
- occurredAt, receivedAt
- rawPayloadRef or safe normalized metadata JSON (never store secrets)
- unique(providerEventId) where supported
- indexes(organizationId, occurredAt), (githubAccountId, occurredAt), (repositoryId, occurredAt)

### WebhookDelivery
- id, provider, deliveryId unique, eventType, action nullable
- receivedAt, processedAt nullable
- status: RECEIVED | PROCESSING | PROCESSED | FAILED
- attemptCount, safeErrorCode nullable
- payload stored only if necessary and sanitized; preferably persist normalized required data.

### GitHubSyncLog
- id, installationId nullable, repositoryId nullable
- status, startedAt, completedAt, recordsProcessed, errorCode nullable

### LearningPath
- id, organizationId, title, description, createdById, visibility

### LearningMilestone
- id, learningPathId, title, description, sortOrder, skillId nullable

### Skill
- id, organizationId nullable (global or org custom), name, category

### MenteeMilestone
- id, menteeId, milestoneId
- status: NOT_STARTED | IN_PROGRESS | SUBMITTED | APPROVED
- evidenceUrl nullable, notes nullable
- reviewedById nullable, reviewedAt nullable

### Feedback
- id, organizationId, menteeId, authorId
- category
- content
- visibility: PRIVATE_TO_MENTEE | PRIVATE_TO_MENTORS | COHORT
- createdAt, updatedAt, deletedAt nullable

### Announcement
- id, organizationId, cohortId nullable
- authorId, title, body, publishedAt, archivedAt

### Event
- id, organizationId, cohortId nullable
- title, description, startsAt, endsAt, timezone
- meetingUrl nullable, location nullable, createdById

### Attendance
- id, eventId, userId
- status: PRESENT | ABSENT | EXCUSED | NOT_RECORDED
- recordedById, note nullable, recordedAt
- unique(eventId, userId)

### DiscussionPost / DiscussionComment
Store organization/cohort scope, author, content, visibility, timestamps and moderation status. Validate membership and sanitize rendered content.

### Notification
- id, organizationId nullable, userId
- type, title, body, targetUrl nullable
- readAt, createdAt
- dedupeKey nullable unique per recipient/event.

### AuditLog
- id, organizationId nullable, actorId nullable
- action, targetType, targetId
- metadata JSON safe allowlist
- requestId, createdAt
- append-only.

## Modeling rules
- Prefer normalized relations for membership and assignments.
- Use JSON only for provider metadata or flexible settings, with runtime validation.
- Avoid storing full GitHub webhook payloads indefinitely.
- Use database constraints for uniqueness and referential integrity.
- Define delete behavior explicitly. Prefer restrict/cascade only where safe; preserve audit history.
- Add indexes based on actual list/filter patterns.
- Use transactions for enrollment, assignment and review state changes.
- Use a migration for every schema change.

## Prisma implementation
The final `schema.prisma` must include all core models/enums/relations, not just the sample models in this document. If scope must be staged, all MVP entities must be implemented before calling the app complete.
