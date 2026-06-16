// types/database.ts
// Complete TypeScript types matching the Supabase database schema

// ============================================================
// ORGANIZATIONS
// ============================================================

export type OrganizationRow = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  settings: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type OrganizationInsert = {
  id?: string
  name: string
  slug: string
  logo_url?: string | null
  settings?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export type OrganizationUpdate = {
  id?: string
  name?: string
  slug?: string
  logo_url?: string | null
  settings?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

// ============================================================
// PROJECTS
// ============================================================

export type ProjectRow = {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  status: 'active' | 'archived' | 'draft'
  settings: Record<string, unknown> | null
  created_by: string
  created_at: string
  updated_at: string
}

export type ProjectInsert = {
  id?: string
  organization_id: string
  name: string
  slug: string
  description?: string | null
  status?: 'active' | 'archived' | 'draft'
  settings?: Record<string, unknown> | null
  created_by: string
  created_at?: string
  updated_at?: string
}

export type ProjectUpdate = {
  id?: string
  organization_id?: string
  name?: string
  slug?: string
  description?: string | null
  status?: 'active' | 'archived' | 'draft'
  settings?: Record<string, unknown> | null
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ============================================================
// PROJECT MEMBERS
// ============================================================

export type ProjectMemberRow = {
  id: string
  project_id: string
  user_id: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  invited_by: string | null
  joined_at: string
  created_at: string
  updated_at: string
}

export type ProjectMemberInsert = {
  id?: string
  project_id: string
  user_id: string
  role?: 'owner' | 'admin' | 'editor' | 'viewer'
  invited_by?: string | null
  joined_at?: string
  created_at?: string
  updated_at?: string
}

export type ProjectMemberUpdate = {
  id?: string
  project_id?: string
  user_id?: string
  role?: 'owner' | 'admin' | 'editor' | 'viewer'
  invited_by?: string | null
  joined_at?: string
  created_at?: string
  updated_at?: string
}

// ============================================================
// DEPLOYMENTS
// ============================================================

export type DeploymentRow = {
  id: string
  project_id: string
  version: string
  status: 'pending' | 'building' | 'deployed' | 'failed' | 'cancelled'
  url: string | null
  commit_sha: string | null
  commit_message: string | null
  branch: string | null
  deployed_by: string
  metadata: Record<string, unknown> | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type DeploymentInsert = {
  id?: string
  project_id: string
  version: string
  status?: 'pending' | 'building' | 'deployed' | 'failed' | 'cancelled'
  url?: string | null
  commit_sha?: string | null
  commit_message?: string | null
  branch?: string | null
  deployed_by: string
  metadata?: Record<string, unknown> | null
  error_message?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}

export type DeploymentUpdate = {
  id?: string
  project_id?: string
  version?: string
  status?: 'pending' | 'building' | 'deployed' | 'failed' | 'cancelled'
  url?: string | null
  commit_sha?: string | null
  commit_message?: string | null
  branch?: string | null
  deployed_by?: string
  metadata?: Record<string, unknown> | null
  error_message?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at?: string
  updated_at?: string
}

// ============================================================
// SCREENS
// ============================================================

export type ScreenRow = {
  id: string
  project_id: string
  deployment_id: string | null
  name: string
  slug: string
  path: string | null
  screenshot_url: string | null
  thumbnail_url: string | null
  width: number | null
  height: number | null
  order_index: number
  metadata: Record<string, unknown> | null
  created_by: string
  created_at: string
  updated_at: string
}

export type ScreenInsert = {
  id?: string
  project_id: string
  deployment_id?: string | null
  name: string
  slug: string
  path?: string | null
  screenshot_url?: string | null
  thumbnail_url?: string | null
  width?: number | null
  height?: number | null
  order_index?: number
  metadata?: Record<string, unknown> | null
  created_by: string
  created_at?: string
  updated_at?: string
}

export type ScreenUpdate = {
  id?: string
  project_id?: string
  deployment_id?: string | null
  name?: string
  slug?: string
  path?: string | null
  screenshot_url?: string | null
  thumbnail_url?: string | null
  width?: number | null
  height?: number | null
  order_index?: number
  metadata?: Record<string, unknown> | null
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ============================================================
// COMMENT THREADS
// ============================================================

export type CommentThreadRow = {
  id: string
  screen_id: string
  project_id: string
  status: 'open' | 'resolved' | 'archived'
  position_x: number | null
  position_y: number | null
  position_width: number | null
  position_height: number | null
  resolved_by: string | null
  resolved_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type CommentThreadInsert = {
  id?: string
  screen_id: string
  project_id: string
  status?: 'open' | 'resolved' | 'archived'
  position_x?: number | null
  position_y?: number | null
  position_width?: number | null
  position_height?: number | null
  resolved_by?: string | null
  resolved_at?: string | null
  created_by: string
  created_at?: string
  updated_at?: string
}

export type CommentThreadUpdate = {
  id?: string
  screen_id?: string
  project_id?: string
  status?: 'open' | 'resolved' | 'archived'
  position_x?: number | null
  position_y?: number | null
  position_width?: number | null
  position_height?: number | null
  resolved_by?: string | null
  resolved_at?: string | null
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ============================================================
// COMMENTS
// ============================================================

export type CommentRow = {
  id: string
  thread_id: string
  project_id: string
  parent_id: string | null
  content: string
  content_html: string | null
  attachments: Array<Record<string, unknown>> | null
  mentions: string[] | null
  is_edited: boolean
  edited_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type CommentInsert = {
  id?: string
  thread_id: string
  project_id: string
  parent_id?: string | null
  content: string
  content_html?: string | null
  attachments?: Array<Record<string, unknown>> | null
  mentions?: string[] | null
  is_edited?: boolean
  edited_at?: string | null
  created_by: string
  created_at?: string
  updated_at?: string
}

export type CommentUpdate = {
  id?: string
  thread_id?: string
  project_id?: string
  parent_id?: string | null
  content?: string
  content_html?: string | null
  attachments?: Array<Record<string, unknown>> | null
  mentions?: string[] | null
  is_edited?: boolean
  edited_at?: string | null
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ============================================================
// COMMENT HISTORY
// ============================================================

export type CommentHistoryRow = {
  id: string
  comment_id: string
  content: string
  content_html: string | null
  edited_by: string
  edited_at: string
  created_at: string
}

export type CommentHistoryInsert = {
  id?: string
  comment_id: string
  content: string
  content_html?: string | null
  edited_by: string
  edited_at?: string
  created_at?: string
}

export type CommentHistoryUpdate = {
  id?: string
  comment_id?: string
  content?: string
  content_html?: string | null
  edited_by?: string
  edited_at?: string
  created_at?: string
}

// ============================================================
// HANDOFFS
// ============================================================

export type HandoffRow = {
  id: string
  project_id: string
  deployment_id: string | null
  title: string
  description: string | null
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'published'
  version: string | null
  reviewer_id: string | null
  reviewed_at: string | null
  review_notes: string | null
  published_at: string | null
  published_by: string | null
  metadata: Record<string, unknown> | null
  created_by: string
  created_at: string
  updated_at: string
}

export type HandoffInsert = {
  id?: string
  project_id: string
  deployment_id?: string | null
  title: string
  description?: string | null
  status?: 'draft' | 'in_review' | 'approved' | 'rejected' | 'published'
  version?: string | null
  reviewer_id?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  published_at?: string | null
  published_by?: string | null
  metadata?: Record<string, unknown> | null
  created_by: string
  created_at?: string
  updated_at?: string
}

export type HandoffUpdate = {
  id?: string
  project_id?: string
  deployment_id?: string | null
  title?: string
  description?: string | null
  status?: 'draft' | 'in_review' | 'approved' | 'rejected' | 'published'
  version?: string | null
  reviewer_id?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  published_at?: string | null
  published_by?: string | null
  metadata?: Record<string, unknown> | null
  created_by?: string
  created_at?: string
  updated_at?: string
}

// ============================================================
// AUDIT LOGS
// ============================================================

export type AuditLogRow = {
  id: string
  project_id: string | null
  organization_id: string | null
  actor_id: string
  action: string
  resource_type: string
  resource_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type AuditLogInsert = {
  id?: string
  project_id?: string | null
  organization_id?: string | null
  actor_id: string
  action: string
  resource_type: string
  resource_id?: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
  ip_address?: string | null
  user_agent?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string
}

export type AuditLogUpdate = {
  id?: string
  project_id?: string | null
  organization_id?: string | null
  actor_id?: string
  action?: string
  resource_type?: string
  resource_id?: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
  ip_address?: string | null
  user_agent?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string
}

// ============================================================
// DATABASE TYPE (Supabase format)
// ============================================================

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow
        Insert: OrganizationInsert
        Update: OrganizationUpdate
      }
      projects: {
        Row: ProjectRow
        Insert: ProjectInsert
        Update: ProjectUpdate
      }
      project_members: {
        Row: ProjectMemberRow
        Insert: ProjectMemberInsert
        Update: ProjectMemberUpdate
      }
      deployments: {
        Row: DeploymentRow
        Insert: DeploymentInsert
        Update: DeploymentUpdate
      }
      screens: {
        Row: ScreenRow
        Insert: ScreenInsert
        Update: ScreenUpdate
      }
      comment_threads: {
        Row: CommentThreadRow
        Insert: CommentThreadInsert
        Update: CommentThreadUpdate
      }
      comments: {
        Row: CommentRow
        Insert: CommentInsert
        Update: CommentUpdate
      }
      comment_history: {
        Row: CommentHistoryRow
        Insert: CommentHistoryInsert
        Update: CommentHistoryUpdate
      }
      handoffs: {
        Row: HandoffRow
        Insert: HandoffInsert
        Update: HandoffUpdate
      }
      audit_logs: {
        Row: AuditLogRow
        Insert: AuditLogInsert
        Update: AuditLogUpdate
      }
    }
    Functions: {
      get_user_project_role: {
        Args: { project_id: string }
        Returns: string | null
      }
      is_project_member: {
        Args: { project_id: string }
        Returns: boolean
      }
      has_project_role: {
        Args: { project_id: string; required_roles: string[] }
        Returns: boolean
      }
      get_thread_with_comments: {
        Args: { p_thread_id: string }
        Returns: any
      }
      get_screen_comment_count: {
        Args: { p_screen_id: string }
        Returns: number
      }
      generate_version_number: {
        Args: { p_project_id: string }
        Returns: string
      }
    }
  }
}
