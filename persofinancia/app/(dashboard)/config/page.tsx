// persofinancia/app/(dashboard)/config/page.tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types/database'

const CONFIG_LINKS = [
  {
    href: '/config/bancos',
    label: 'Bancos conectados',
    desc: 'Gestiona tus fuentes de datos',
  },
  {
    href: '/config/sync-history',
    label: 'Historial de sincronizaciones',
    desc: 'Últimas lecturas de Gmail (cron + manual)',
  },
  {
    href: '/config/compromisos',
    label: 'Compromisos bancarios',
    desc: 'Créditos, tarjetas y préstamos',
  },
  {
    href: '/config/categorias',
    label: 'Categorias',
    desc: 'Crea y edita tus categorias',
  },
  {
    href: '/config/reglas',
    label: 'Reglas automaticas',
    desc: 'Define reglas de categorizacion',
  },
  {
    href: '/config/importar',
    label: 'Importar CSV',
    desc: 'Sube extractos bancarios',
  },
  {
    href: '/config/tema',
    label: 'Apariencia',
    desc: 'Claro, oscuro o sistema',
  },
] as const

async function signOut() {
  'use server'
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function ConfigPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('nombre, email')
    .eq('user_id', user.id)
    .single()
  const profile = profileRaw as Pick<Profile, 'nombre' | 'email'> | null

  return (
    <div className="p-4 space-y-6">
      <div className="pt-4">
        <h1 className="text-xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {profile?.nombre} &middot; {profile?.email}
        </p>
      </div>

      <div className="space-y-2">
        {CONFIG_LINKS.map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:bg-muted/50 active:scale-[0.98] transition-all"
          >
            <div className="flex-1">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="w-full text-destructive text-sm py-3 hover:underline"
        >
          Cerrar sesion
        </button>
      </form>
    </div>
  )
}
