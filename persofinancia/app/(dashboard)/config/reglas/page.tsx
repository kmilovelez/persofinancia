// persofinancia/app/(dashboard)/config/reglas/page.tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { ReglaCategoria, Categoria } from '@/lib/types/database'

type ReglaWithCategoria = ReglaCategoria & { categorias: { nombre: string } | null }

async function createRegla(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const categoria_id = String(formData.get('categoria_id') ?? '').trim()
  const campo = String(formData.get('campo') ?? '').trim()
  const operador = String(formData.get('operador') ?? '').trim()
  const valor = String(formData.get('valor') ?? '').trim().toUpperCase()
  const prioridad = parseInt(String(formData.get('prioridad') ?? '100'))

  if (!categoria_id || !campo || !operador || !valor) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('reglas_categoria').insert({
    user_id: user.id,
    categoria_id,
    campo,
    operador,
    valor,
    prioridad: isNaN(prioridad) ? 100 : prioridad,
    activa: true,
    origen: 'manual',
  })
  revalidatePath('/config/reglas')
}

async function deleteRegla(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('reglas_categoria').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/config/reglas')
}

const CAMPO_LABELS: Record<string, string> = {
  descripcion: 'Descripcion',
  monto: 'Monto',
  tipo: 'Tipo',
  banco: 'Banco',
}

const OPERADOR_LABELS: Record<string, string> = {
  contains: 'contiene',
  starts_with: 'empieza con',
  equals: 'es igual a',
  gt: 'mayor que',
  lt: 'menor que',
}

export default async function ReglasPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: reglasRaw }, { data: categoriasRaw }] = await Promise.all([
    supabase
      .from('reglas_categoria')
      .select('*, categorias(nombre)')
      .eq('user_id', user.id)
      .order('prioridad'),
    supabase
      .from('categorias')
      .select('id, nombre')
      .eq('user_id', user.id)
      .order('nombre'),
  ])
  const reglas = (reglasRaw ?? []) as ReglaWithCategoria[]
  const categorias = (categoriasRaw ?? []) as Pick<Categoria, 'id' | 'nombre'>[]

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold pt-4">Reglas de categorizacion</h1>

      {/* Create form */}
      <form
        action={createRegla}
        className="bg-card border border-border rounded-xl p-4 space-y-3"
      >
        <p className="font-semibold text-sm">Nueva regla</p>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Campo</Label>
              <select
                name="campo"
                required
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Seleccionar</option>
                <option value="descripcion">Descripcion</option>
                <option value="monto">Monto</option>
                <option value="tipo">Tipo</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operador</Label>
              <select
                name="operador"
                required
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Seleccionar</option>
                <option value="contains">contiene</option>
                <option value="starts_with">empieza con</option>
                <option value="equals">es igual a</option>
                <option value="gt">mayor que</option>
                <option value="lt">menor que</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor="valor">Valor</Label>
            <Input id="valor" name="valor" placeholder='Ej: RAPPI' required />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Categoria destino</Label>
              <select
                name="categoria_id"
                required
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Seleccionar</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="prioridad">Prioridad</Label>
              <Input
                id="prioridad"
                name="prioridad"
                type="number"
                placeholder="100"
                defaultValue="100"
                min="1"
                max="999"
              />
            </div>
          </div>
        </div>
        <Button type="submit" size="sm" className="w-full">
          Crear regla
        </Button>
      </form>

      {/* List */}
      <div className="space-y-2">
        {!reglas.length && (
          <p className="text-muted-foreground text-sm text-center py-6">
            Sin reglas. Crea la primera arriba.
          </p>
        )}
        {reglas.map((regla) => (
          <div
            key={regla.id}
            className="bg-card border border-border rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={regla.origen === 'manual' ? 'default' : 'secondary'} className="text-xs">
                  {regla.origen === 'manual' ? 'Manual' : 'Sugerida IA'}
                </Badge>
                <span className="text-xs text-muted-foreground">#{regla.prioridad}</span>
              </div>
              <form action={deleteRegla}>
                <input type="hidden" name="id" value={regla.id} />
                <Button type="submit" variant="ghost" size="sm" className="text-destructive h-7 px-2">
                  Borrar
                </Button>
              </form>
            </div>
            <p className="text-sm">
              Si <span className="font-medium">{CAMPO_LABELS[regla.campo] ?? regla.campo}</span>{' '}
              {OPERADOR_LABELS[regla.operador] ?? regla.operador}{' '}
              <span className="font-medium text-primary">&ldquo;{regla.valor}&rdquo;</span>
            </p>
            <p className="text-xs text-green-500">
              Categoria: {regla.categorias?.nombre ?? 'N/A'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
