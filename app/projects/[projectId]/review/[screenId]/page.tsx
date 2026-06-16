import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReviewCanvas from './ReviewCanvas'

export default async function ReviewPage({ params }: { params: { projectId: string; screenId: string } }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: screen } = await supabase
    .from('screens')
    .select('*')
    .eq('id', params.screenId)
    .single()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.projectId)
    .single()

  if (!screen || !project) notFound()

  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', params.projectId)
    .eq('user_id', user.id)
    .single()

  if (!member) notFound()

  const { data: deployments } = await supabase
    .from('deployments')
    .select('*')
    .eq('project_id', params.projectId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })

  return (
    <ReviewCanvas
      screenId={params.screenId}
      projectId={params.projectId}
      userRole={member.role as any}
      screen={{
        id: screen.id,
        name: screen.name,
        vercel_url: (deployments?.[0] as any)?.vercel_url ?? null,
        thumbnail_url: null,
        version: (deployments?.[0] as any)?.version_number ?? '1.0.0',
        created_at: screen.created_at,
      }}
      project={{ id: project.id, name: project.name, slug: project.slug }}
      initialThreads={[]}
      deployments={(deployments ?? []).map((d: any) => ({
        id: d.id,
        version: d.version_number,
        url: d.vercel_url ?? '',
        created_at: d.created_at,
        is_current: d.id === deployments?.[0]?.id,
      }))}
    />
  )
}
