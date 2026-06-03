// persofinancia/components/layout/alerts-bell.tsx
// Floating bell in top-right with unread alert count.
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function AlertsBell() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { count } = await supabase
    .from('alertas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('leida', false)
    .eq('descartada', false)

  const unread = count ?? 0

  return (
    <Link
      href="/alertas"
      className="fixed top-3 right-3 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border shadow-sm hover:bg-muted transition-colors"
      aria-label={`Alertas (${unread} sin leer)`}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
