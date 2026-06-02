// persofinancia/app/api/auth/gmail/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await getSupabaseServerClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'email profile https://www.googleapis.com/auth/gmail.readonly',
      redirectTo: `${appUrl}/api/auth/gmail/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(`${appUrl}/config/bancos?error=oauth_failed`)
  }

  return NextResponse.redirect(data.url)
}
