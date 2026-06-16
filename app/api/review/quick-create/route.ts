import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url, name } = await request.json()
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    // Use service role to bypass RLS
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get or create personal org
    const orgSlug = `user-${user.id.slice(0, 8)}`
    let orgId: string

    const { data: existingOrg } = await service
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .maybeSingle()

    if (existingOrg) {
      orgId = existingOrg.id
    } else {
      const { data: newOrg, error: orgErr } = await service
        .from('organizations')
        .insert({ name: 'Minhas Reviews', slug: orgSlug })
        .select('id')
        .single()
      if (orgErr || !newOrg) {
        console.error('org error:', orgErr)
        return NextResponse.json({ error: 'Erro ao criar organização' }, { status: 500 })
      }
      orgId = newOrg.id
    }

    // Create project
    const projectName = name?.trim() || new URL(url).hostname
    const projectSlug = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40) + '-' + Date.now()

    const { data: project, error: projErr } = await service
      .from('projects')
      .insert({ name: projectName, slug: projectSlug, organization_id: orgId, created_by: user.id })
      .select('id')
      .single()
    if (projErr || !project) {
      console.error('project error:', projErr)
      return NextResponse.json({ error: 'Erro ao criar projeto' }, { status: 500 })
    }

    // Add user as owner
    await service
      .from('project_members')
      .insert({ project_id: project.id, user_id: user.id, role: 'owner' })

    // Create deployment
    const { data: deployment, error: depErr } = await service
      .from('deployments')
      .insert({ project_id: project.id, version_number: '1.0.0', vercel_url: url.trim(), environment: 'preview', status: 'ready', deployed_by: user.id })
      .select('id')
      .single()
    if (depErr || !deployment) {
      console.error('deployment error:', depErr)
      return NextResponse.json({ error: 'Erro ao criar deployment' }, { status: 500 })
    }

    // Create screen
    const { data: screen, error: screenErr } = await service
      .from('screens')
      .insert({ project_id: project.id, deployment_id: deployment.id, name: projectName, route: '/', created_by: user.id })
      .select('id')
      .single()
    if (screenErr || !screen) {
      console.error('screen error:', screenErr)
      return NextResponse.json({ error: 'Erro ao criar screen' }, { status: 500 })
    }

    return NextResponse.json({ projectId: project.id, screenId: screen.id })
  } catch (err: any) {
    console.error('quick-create error:', err)
    return NextResponse.json({ error: err.message ?? 'Erro inesperado' }, { status: 500 })
  }
}
