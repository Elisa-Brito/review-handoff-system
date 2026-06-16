import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim())
    // Remove trailing slash from pathname, lowercase host
    u.pathname = u.pathname.replace(/\/+$/, '') || '/'
    return u.origin + u.pathname + u.search
  } catch {
    return raw.trim()
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL obrigatória' }, { status: 400 })

    const normalized = normalizeUrl(url)

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('url', normalized)
      .maybeSingle()

    if (existing) return NextResponse.json({ id: existing.id })

    const { data, error } = await supabase
      .from('reviews')
      .insert({ url: normalized })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
