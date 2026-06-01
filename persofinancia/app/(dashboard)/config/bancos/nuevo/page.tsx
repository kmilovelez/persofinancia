// persofinancia/app/(dashboard)/config/bancos/nuevo/page.tsx
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const BANCOS_PRESET = [
  { nombre: 'Bancolombia', icono: '🏦', query: 'from:(notificacionesbancolombia.com OR bancolombia.com.co)', parser_type: 'bancolombia' },
  { nombre: 'Nequi',       icono: '💜', query: 'from:nequi.com.co',                parser_type: 'nequi' },
  { nombre: 'RappiCard',   icono: '🧡', query: 'from:rappi.com',                   parser_type: 'rappicard' },
  { nombre: 'Banco de Occidente', icono: '🏛️', query: 'from:bancodeoccidente.com.co', parser_type: 'occidente' },
  { nombre: 'Lulobank',    icono: '🟢', query: 'from:lulobank.com',                parser_type: 'lulobank' },
  { nombre: 'NU',          icono: '🟣', query: 'from:nu.com.co',                   parser_type: 'nu' },
  { nombre: 'Hapi',        icono: '🔵', query: 'from:hapi.com.co',                 parser_type: 'hapi' },
] as const

async function addBancoPreset(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const nombre = String(formData.get('nombre') ?? '')
  const icono = String(formData.get('icono') ?? '🏦')
  const gmail_query = String(formData.get('gmail_query') ?? '')
  const parser_type = String(formData.get('parser_type') ?? 'generic')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('bancos').insert({
    user_id: user.id,
    nombre,
    icono,
    gmail_query,
    parser_type,
    activo: false,
  })
  redirect('/config/bancos')
}

async function addBancoCustom(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const nombre = String(formData.get('nombre') ?? '').trim()
  const icono = String(formData.get('icono') ?? '🏦').trim()
  const gmail_query = String(formData.get('gmail_query') ?? '').trim()

  if (!nombre || !gmail_query) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('bancos').insert({
    user_id: user.id,
    nombre,
    icono,
    gmail_query,
    parser_type: 'generic',
    activo: false,
  })
  redirect('/config/bancos')
}

export default async function NuevoBancoPage() {
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold pt-4">Agregar banco</h1>

      {/* Preset banks */}
      <div>
        <p className="text-sm font-medium mb-3">Bancos preconfigurados</p>
        <div className="grid grid-cols-2 gap-2">
          {BANCOS_PRESET.map((b) => (
            <form key={b.nombre} action={addBancoPreset}>
              <input type="hidden" name="nombre" value={b.nombre} />
              <input type="hidden" name="icono" value={b.icono} />
              <input type="hidden" name="gmail_query" value={b.query} />
              <input type="hidden" name="parser_type" value={b.parser_type} />
              <button
                type="submit"
                className="w-full flex items-center gap-2 bg-card border border-border rounded-xl p-3 hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
              >
                <span className="text-xl">{b.icono}</span>
                <span className="text-sm font-medium">{b.nombre}</span>
              </button>
            </form>
          ))}
        </div>
      </div>

      {/* Custom bank */}
      <div className="border-t border-border pt-4">
        <p className="text-sm font-medium mb-3">Banco personalizado</p>
        <form action={addBancoCustom} className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1 col-span-1">
              <Label className="text-xs">Icono</Label>
              <Input name="icono" defaultValue="🏦" maxLength={2} className="text-center" />
            </div>
            <div className="space-y-1 col-span-3">
              <Label className="text-xs">Nombre</Label>
              <Input name="nombre" placeholder="Mi banco" required />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gmail query</Label>
            <Input name="gmail_query" placeholder="from:mibank.com" required />
            <p className="text-xs text-muted-foreground">
              Misma sintaxis que la busqueda de Gmail
            </p>
          </div>
          <Button type="submit" className="w-full">
            Guardar banco
          </Button>
        </form>
      </div>
    </div>
  )
}
