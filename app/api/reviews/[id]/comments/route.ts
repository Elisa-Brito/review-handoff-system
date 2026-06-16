import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('pins')
    .select('*')
    .eq('review_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { x_percent, y_percent, body, author_name } = await req.json()
    if (!body?.trim()) return NextResponse.json({ error: 'Comentário obrigatório' }, { status: 400 })

    const { data, error } = await supabase
      .from('pins')
      .insert({ review_id: params.id, x_percent, y_percent, body: body.trim(), author_name: author_name?.trim() || 'Anônimo' })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
