// persofinancia/app/(dashboard)/config/bancos/page.tsx
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { BancoItem } from '@/components/config/banco-item'
import { Button } from '@/components/ui/button'
import type { Banco } from '@/lib/types/database'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function syncNow(_formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    await fetch(`${appUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // Ingest failed silently — user will see no change
  }
  revalidatePath('/config/bancos')
}

export default async function BancosPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any

  const [{ data: bancosRaw }, { data: profileRaw }] = await Promise.all([
    supabaseAny.from('bancos').select('*').eq('user_id', user.id).order('nombre'),
    supabaseAny.from('profiles').select('gmail_token').eq('user_id', user.id).single(),
  ])

  const bancos = bancosRaw as Banco[] | null
  const gmailConectado = !!(profileRaw as { gmail_token: string | null } | null)?.gmail_token

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-xl font-bold">Bancos conectados</h1>
        <Link href="/config/bancos/nuevo">
          <Button size="sm" variant="outline" className="gap-1">
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </Link>
      </div>

      {!gmailConectado && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 space-y-2">
          <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
            Gmail no conectado
          </p>
          <p className="text-xs text-muted-foreground">
            Conecta tu Gmail para habilitar la ingesta automatica de movimientos
          </p>
          <Link href="/api/auth/gmail" className="text-xs text-primary font-medium">
            Conectar Gmail →
          </Link>
        </div>
      )}

      {gmailConectado && (
        <form action={syncNow}>
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Sincronizar ahora
          </Button>
        </form>
      )}

      <div className="space-y-2">
        {!bancos?.length && (
          <p className="text-muted-foreground text-sm text-center py-8">
            No tienes bancos configurados. Agrega uno para empezar.
          </p>
        )}
        {(bancos ?? []).map((banco) => (
          <BancoItem key={banco.id} banco={banco} />
        ))}
      </div>
    </div>
  )
}
