// persofinancia/app/(dashboard)/config/presupuestos/page.tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { fmtFull } from '@/lib/utils/currency'
import type { Categoria } from '@/lib/types/database'

async function upsertPresupuesto(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const categoria_id = String(formData.get('categoria_id') ?? '')
  const monto = parseFloat(String(formData.get('monto') ?? '0'))

  if (!categoria_id || isNaN(monto) || monto < 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('presupuestos') as any).upsert(
    { user_id: user.id, categoria_id, monto, activo: true },
    { onConflict: 'user_id,categoria_id' }
  )
  revalidatePath('/config/presupuestos')
  revalidatePath('/analitica')
}

export default async function PresupuestosPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cats } = await supabase
    .from('categorias')
    .select('*')
    .eq('user_id', user.id)
    .neq('grupo', 'Ingreso')
    .order('grupo')
    .order('nombre')

  const { data: presup } = await supabase
    .from('presupuestos')
    .select('*')
    .eq('user_id', user.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const presupMap = new Map((presup ?? []).map((p: any) => [p.categoria_id, p.monto]))
  const categorias = (cats ?? []) as Categoria[]
  const totalPresupuestado = (presup ?? []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: number, p: any) => s + Number(p.monto), 0
  )

  const { data: ingresosRaw } = await supabase
    .from('movimientos')
    .select('monto, fecha')
    .eq('user_id', user.id)
    .eq('flujo', 'in')

  const ingresos = (ingresosRaw ?? []) as { monto: number; fecha: string }[]

  const ingresosByMonth = new Map<string, number>()
  for (const m of ingresos) {
    const mes = m.fecha.slice(0, 7)
    ingresosByMonth.set(mes, (ingresosByMonth.get(mes) ?? 0) + Number(m.monto))
  }
  const months = Array.from(ingresosByMonth.values())
  const avgIngreso = months.length > 0 ? months.reduce((a, b) => a + b, 0) / months.length : 0
  const pctOfIncome = avgIngreso > 0 ? (totalPresupuestado / avgIngreso) * 100 : 0

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-xl font-bold">Presupuestos</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Define cuánto deseas gastar por categoría cada mes
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-1">
        <p className="text-xs text-muted-foreground uppercase">Total presupuestado</p>
        <p className="text-2xl font-bold">{fmtFull(totalPresupuestado)}</p>
        <p className="text-xs text-muted-foreground">
          Ingreso promedio mensual: {fmtFull(avgIngreso)}
        </p>
        {avgIngreso > 0 && (
          <p className={`text-xs font-medium ${pctOfIncome > 100 ? 'text-red-500' : pctOfIncome > 80 ? 'text-yellow-500' : 'text-green-500'}`}>
            Tu presupuesto es {pctOfIncome.toFixed(0)}% de tu ingreso promedio
            {pctOfIncome > 100 && ' — ⚠ supera tu ingreso'}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {categorias.map((cat) => (
          <form
            key={cat.id}
            action={upsertPresupuesto}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
          >
            <span className="text-xl shrink-0">{cat.icono}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{cat.nombre}</p>
              <p className="text-xs text-muted-foreground">{cat.grupo}</p>
            </div>
            <input type="hidden" name="categoria_id" value={cat.id} />
            <input
              type="number"
              name="monto"
              defaultValue={presupMap.get(cat.id) ?? ''}
              placeholder="0"
              min="0"
              step="1000"
              className="w-32 bg-background border border-input rounded-md px-3 py-1.5 text-sm text-right"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs font-medium"
            >
              ✓
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
