import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/'
  // Prevent open redirect: only allow relative paths
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  if (code) {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // If this OAuth flow includes Google with Gmail scope, store the
      // provider_token + provider_refresh_token in profiles for the Edge Function.
      // session.provider_token = Google access_token (expires in 1h)
      // session.provider_refresh_token = Google refresh_token (long-lived)
      const session = data.session
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sess = session as any
      if (sess.provider_token && data.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const update: Record<string, any> = {
          gmail_token: sess.provider_token,
          gmail_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        }
        if (sess.provider_refresh_token) {
          update.gmail_refresh_token = sess.provider_refresh_token
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update(update)
          .eq('user_id', data.user.id)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
