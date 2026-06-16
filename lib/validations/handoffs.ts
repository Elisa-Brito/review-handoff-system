import { z } from 'zod'

export const UserStorySchema = z.object({
  id: z.string().uuid(),
  role: z.string().min(1),
  action: z.string().min(1),
  benefit: z.string().min(1),
})

export const AcceptanceCriteriaSchema = z.object({
  id: z.string().uuid(),
  scenario: z.string().min(1),
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
})

export const EdgeCaseSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  handling: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
})

export const ApiDependencySchema = z.object({
  id: z.string().uuid(),
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  description: z.string().min(1),
  required: z.boolean(),
  request_schema: z.record(z.unknown()).optional(),
  response_schema: z.record(z.unknown()).optional(),
})

export const AnalyticsEventSchema = z.object({
  id: z.string().uuid(),
  event_name: z.string().min(1),
  trigger: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
})

export const DesignDecisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.string().min(1),
  rationale: z.string().min(1),
  alternatives_considered: z.array(z.string()).optional(),
})

export const GenerateHandoffSchema = z.object({
  project_id: z.string().uuid(),
  screen_id: z.string().uuid().optional(),
  deployment_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  overview: z.string().min(1),
  business_objective: z.string().min(1),
  user_stories: z.array(UserStorySchema).min(1),
  acceptance_criteria: z.array(AcceptanceCriteriaSchema).min(1),
  edge_cases: z.array(EdgeCaseSchema),
  api_dependencies: z.array(ApiDependencySchema),
  analytics_events: z.array(AnalyticsEventSchema),
  technical_notes: z.string(),
  design_decisions: z.array(DesignDecisionSchema),
})

export const UpdateHandoffSchema = GenerateHandoffSchema.partial()

export const PublishHandoffSchema = z.object({
  status: z.enum(['published', 'archived']),
})

export const GetHandoffsQuerySchema = z.object({
  project_id: z.string().uuid(),
  screen_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

export type UserStory = z.infer<typeof UserStorySchema>
export type AcceptanceCriteria = z.infer<typeof AcceptanceCriteriaSchema>
export type EdgeCase = z.infer<typeof EdgeCaseSchema>
export type ApiDependency = z.infer<typeof ApiDependencySchema>
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>
export type DesignDecision = z.infer<typeof DesignDecisionSchema>
export type GenerateHandoff = z.infer<typeof GenerateHandoffSchema>
export type UpdateHandoff = z.infer<typeof UpdateHandoffSchema>
export type PublishHandoff = z.infer<typeof PublishHandoffSchema>
export type GetHandoffsQuery = z.infer<typeof GetHandoffsQuerySchema>
