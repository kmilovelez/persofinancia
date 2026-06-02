// persofinancia/app/(dashboard)/config/categorias/page.tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Categoria } from '@/lib/types/database'

async function createCategoria(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const nombre = String(formData.get('nombre') ?? '').trim()
  const grupo = String(formData.get('grupo') ?? 'Variable').trim()
  const icono = String(formData.get('icono') ?? '📌').trim()
  const color = String(formData.get('color') ?? '#64748b')

  if (!nombre) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('categorias').insert({
    user_id: user.id,
    nombre,
    grupo,
    subgrupo: '',
    icono,
    color,
  })
  revalidatePath('/config/categorias')
}

async function deleteCategoria(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('categorias').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/config/categorias')
}

export default async function CategoriasPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categoriasRaw } = await supabase
    .from('categorias')
    .select('*')
    .eq('user_id', user.id)
    .order('nombre')
  const categorias = (categoriasRaw ?? []) as Categoria[]

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold pt-4">Categorias</h1>

      {/* Create form */}
      <form action={createCategoria} className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="font-semibold text-sm">Nueva categoria</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="nombre">Nombre</Label>
            <Input id="nombre" name="nombre" placeholder="Domicilios" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="grupo">Grupo</Label>
            <Input id="grupo" name="grupo" placeholder="Variable" defaultValue="Variable" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="icono">Icono</Label>
            <Input id="icono" name="icono" placeholder="🍕" defaultValue="📌" maxLength={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="color">Color</Label>
            <Input id="color" name="color" type="color" defaultValue="#64748b" className="h-10 p-1 cursor-pointer" />
          </div>
        </div>
        <Button type="submit" size="sm" className="w-full">Crear categoria</Button>
      </form>

      {/* List */}
      <div className="space-y-2">
        {!categorias.length && (
          <p className="text-muted-foreground text-sm text-center py-6">
            Sin categorias. Crea la primera arriba.
          </p>
        )}
        {categorias.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
          >
            <span
              className="text-xl w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: `${cat.color}20` }}
            >
              {cat.icono}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{cat.nombre}</p>
              <p className="text-xs text-muted-foreground">{cat.grupo}</p>
            </div>
            <form action={deleteCategoria}>
              <input type="hidden" name="id" value={cat.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                Borrar
              </Button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
