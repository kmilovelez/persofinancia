// persofinancia/app/api/auth/gmail/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/config/bancos?error=no_code`)
  }

  const supabase = await getSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/config/bancos?error=session_failed`)
  }

  // Save Gmail access token to profile
  const gmailToken = data.session.provider_token
  if (gmailToken) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('profiles')
      .update({ gmail_token: gmailToken })
      .eq('user_id', data.session.user.id)
  }

  return NextResponse.redirect(`${origin}/config/bancos?connected=gmail`)
}
