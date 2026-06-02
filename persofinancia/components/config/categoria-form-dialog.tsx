// persofinancia/components/config/categoria-form-dialog.tsx
'use client'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Categoria } from '@/lib/types/database'

interface Props {
  trigger: React.ReactNode
  categoria?: Categoria
  grupos: string[]
  subgruposPorGrupo: Map<string, string[]>
  onSubmit: (formData: FormData) => Promise<void>
}

const GRUPOS_FIJOS = ['Variable', 'Fijo', 'Ingreso', 'Deuda']

export function CategoriaFormDialog({ trigger, categoria, grupos, subgruposPorGrupo, onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [grupo, setGrupo] = useState(categoria?.grupo ?? 'Variable')
  const allGrupos = Array.from(new Set([...GRUPOS_FIJOS, ...grupos]))
  const subgrupos = subgruposPorGrupo.get(grupo) ?? []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{categoria ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await onSubmit(formData)
            setOpen(false)
          }}
          className="space-y-3"
        >
          {categoria && <input type="hidden" name="id" value={categoria.id} />}
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input name="nombre" defaultValue={categoria?.nombre} placeholder="Domicilios" required />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Grupo</Label>
              <Select name="grupo" defaultValue={grupo} onValueChange={(v) => setGrupo(v ?? 'Variable')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allGrupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subgrupo</Label>
              <Input
                name="subgrupo"
                defaultValue={categoria?.subgrupo}
                list="subgrupos-options"
                placeholder="Alimentación"
              />
              <datalist id="subgrupos-options">
                {subgrupos.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Icono</Label>
              <Input name="icono" defaultValue={categoria?.icono ?? '📌'} maxLength={2} className="text-center" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <Input name="color" type="color" defaultValue={categoria?.color ?? '#64748b'} className="h-10 p-1" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full">{categoria ? 'Guardar cambios' : 'Crear categoría'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
