// persofinancia/app/(dashboard)/chat/page.tsx
// Chat IA: conversación con Groq Llama 3.3 70B con tool use sobre los datos financieros.
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { ChatClient } from './chat-client'

export default async function ChatPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load last 30 messages of history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('chat_messages') as any)
    .select('id, role, content, created_at')
    .eq('user_id', user.id)
    .in('role', ['user','assistant'])
    .order('created_at', { ascending: true })
    .limit(30)

  return <ChatClient initialMessages={(data ?? []) as Array<{ id: number; role: 'user' | 'assistant'; content: string; created_at: string }>} />
}
