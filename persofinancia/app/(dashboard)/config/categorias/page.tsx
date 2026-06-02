// persofinancia/app/(dashboard)/config/categorias/page.tsx
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { CategoriaTree } from '@/components/config/categoria-tree'
import type { Categoria } from '@/lib/types/database'

async function createCategoria(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const nombre = String(formData.get('nombre') ?? '').trim()
  if (!nombre) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('categorias') as any).insert({
    user_id: user.id,
    nombre,
    grupo: String(formData.get('grupo') ?? 'Variable'),
    subgrupo: String(formData.get('subgrupo') ?? '').trim(),
    icono: String(formData.get('icono') ?? '📌').trim(),
    color: String(formData.get('color') ?? '#64748b'),
  })
  revalidatePath('/config/categorias')
}

async function updateCategoria(formData: FormData) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const id = String(formData.get('id') ?? '')
  if (!id) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('categorias') as any).update({
    nombre: String(formData.get('nombre') ?? '').trim(),
    grupo: String(formData.get('grupo') ?? 'Variable'),
    subgrupo: String(formData.get('subgrupo') ?? '').trim(),
    icono: String(formData.get('icono') ?? '📌').trim(),
    color: String(formData.get('color') ?? '#64748b'),
  }).eq('id', id).eq('user_id', user.id)
  revalidatePath('/config/categorias')
}

async function deleteCategoria(id: string) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('categorias').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/config/categorias')
}

async function renameGrupo(oldName: string, newName: string) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('categorias') as any).update({ grupo: newName })
    .eq('user_id', user.id).eq('grupo', oldName)
  revalidatePath('/config/categorias')
}

async function renameSubgrupo(grupo: string, oldName: string, newName: string) {
  'use server'
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('categorias') as any).update({ subgrupo: newName })
    .eq('user_id', user.id).eq('grupo', grupo).eq('subgrupo', oldName)
  revalidatePath('/config/categorias')
}

export default async function CategoriasPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cats } = await supabase
    .from('categorias')
    .select('*')
    .eq('user_id', user.id)
    .order('grupo')
    .order('subgrupo')
    .order('nombre')

  const categorias = (cats ?? []) as Categoria[]

  return (
    <div className="p-4 space-y-4">
      <div className="pt-4">
        <h1 className="text-xl font-bold">Categorías</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Gestiona tus categorías organizadas en 3 niveles: Grupo → Subgrupo → Categoría
        </p>
      </div>

      <CategoriaTree
        categorias={categorias}
        onCreate={createCategoria}
        onUpdate={updateCategoria}
        onDelete={deleteCategoria}
        onRenameGrupo={renameGrupo}
        onRenameSubgrupo={renameSubgrupo}
      />
    </div>
  )
}
