export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import ReviewCanvas from './ReviewCanvas'

export default async function ReviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  )

  const { data: review } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!review) notFound()

  const { data: pins, error: pinsError } = await supabase
    .from('pins')
    .select('*')
    .eq('review_id', params.id)
    .order('created_at', { ascending: true })

return <ReviewCanvas review={review} initialPins={pins ?? []} />
}
