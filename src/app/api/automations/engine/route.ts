import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import type { AutomationTriggerType } from '@/types'

/**
 * Manual trigger for testing or for external integrations that want
 * to fire automations. Auth is required — the caller's user_id is
 * used so RLS-safe data remains per-user.
 * Also allows service role key authentication from backend services.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  let userId = null
  let body = await request.json().catch(() => null)
  
  if (authHeader && serviceKey && authHeader === `Bearer ${serviceKey}`) {
    if (!body?.user_id) {
       return NextResponse.json({ error: 'user_id required for service role calls' }, { status: 400 })
    }
    userId = body.user_id
  } else {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
  }

  if (!body?.trigger_type) {
    return NextResponse.json({ error: 'trigger_type required' }, { status: 400 })
  }

  await runAutomationsForTrigger({
    userId: userId,
    triggerType: body.trigger_type as AutomationTriggerType,
    contactId: body.contact_id ?? null,
    context: body.context ?? {},
  })

  return NextResponse.json({ ok: true })
}
