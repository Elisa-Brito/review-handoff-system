import { z } from 'zod';

export const CreateDeploymentSchema = z.object({
  project_id: z.string().uuid(),
  version_number: z.string().regex(/^\d+\.\d+\.\d+$/),
  vercel_deployment_id: z.string().max(200).optional(),
  vercel_url: z.string().url().optional(),
  commit_sha: z.string().length(40).optional(),
  branch: z.string().max(200).optional(),
  environment: z.enum(['preview', 'production', 'staging']).default('preview'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>;

export const UpdateDeploymentSchema = z.object({
  status: z.enum(['pending', 'building', 'ready', 'error', 'cancelled']),
  vercel_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateDeploymentInput = z.infer<typeof UpdateDeploymentSchema>;

export const VercelWebhookSchema = z.object({
  type: z.string(),
  payload: z.object({
    id: z.string(),
    url: z.string(),
    meta: z.object({
      githubCommitSha: z.string(),
      githubCommitRef: z.string(),
    }),
  }),
});

export type VercelWebhookPayload = z.infer<typeof VercelWebhookSchema>;

export const GetDeploymentsQuerySchema = z.object({
  project_id: z.string().uuid(),
  environment: z.enum(['preview', 'production', 'staging']).optional(),
  status: z.enum(['pending', 'building', 'ready', 'error', 'cancelled']).optional(),
});

export type GetDeploymentsQuery = z.infer<typeof GetDeploymentsQuerySchema>;
