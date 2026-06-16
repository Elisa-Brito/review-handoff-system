// Role type
export type ProjectRole = 'owner' | 'admin' | 'reviewer' | 'viewer'
export type CommentStatus = 'open' | 'resolved' | 'reopened'
export type CommentPriority = 'low' | 'normal' | 'high' | 'critical'
export type DeploymentStatus = 'pending' | 'building' | 'ready' | 'error' | 'cancelled'
export type DeploymentEnvironment = 'preview' | 'production' | 'staging'
export type HandoffStatus = 'draft' | 'published' | 'archived'
export type AuditAction =
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'thread.created'
  | 'thread.status_changed'
  | 'handoff.generated'
  | 'handoff.status_changed'
  | 'deployment.created'
  | 'project.created'
  | 'member.added'
  | 'member.removed'

// User profile (from auth.users)
export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}

// Enriched types with joined data
export interface ProjectWithRole extends Project {
  role: ProjectRole
  member_count: number
}

export interface CommentWithAuthor extends Comment {
  author: UserProfile
}

export interface ThreadWithComments extends CommentThread {
  comments: CommentWithAuthor[]
  comment_count: number
  root_comment: CommentWithAuthor
}

export interface ScreenWithThreadCounts extends Screen {
  open_thread_count: number
  resolved_thread_count: number
}

// Review mode types
export interface ReviewPin {
  thread_id: string
  position_x: number
  position_y: number
  status: CommentStatus
  comment_count: number
  priority: CommentPriority
}

export interface ReviewState {
  isReviewMode: boolean
  selectedPin: string | null
  isPinning: boolean
  pendingPin: { x: number; y: number } | null
}

// Handoff types
export interface HandoffSection {
  overview: string
  businessObjective: string
  userStories: Array<{ id: string; as: string; iWant: string; soThat: string }>
  acceptanceCriteria: Array<{ id: string; criterion: string; status: 'pending' | 'met' | 'failed' }>
  edgeCases: Array<{ id: string; scenario: string; handling: string }>
  apiDependencies: Array<{ id: string; endpoint: string; method: string; description: string; auth: boolean }>
  analyticsEvents: Array<{ id: string; event: string; properties: Record<string, string>; trigger: string }>
  technicalNotes: string
  designDecisions: Array<{ id: string; decision: string; rationale: string; alternatives: string }>
}

// Re-export DB row types
export type {
  OrganizationRow as Organization,
  ProjectRow as Project,
  ProjectMemberRow as ProjectMember,
  DeploymentRow as Deployment,
  ScreenRow as Screen,
  CommentThreadRow as CommentThread,
  CommentRow as Comment,
  CommentHistoryRow as CommentHistory,
  HandoffRow as Handoff,
  AuditLogRow as AuditLog,
} from './database'
