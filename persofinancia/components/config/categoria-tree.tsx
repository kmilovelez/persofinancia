// persofinancia/components/config/categoria-tree.tsx
'use client'
import { useState } from 'react'
import { ChevronRight, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoriaFormDialog } from './categoria-form-dialog'
import type { Categoria } from '@/lib/types/database'

interface Props {
  categorias: Categoria[]
  onCreate: (formData: FormData) => Promise<void>
  onUpdate: (formData: FormData) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRenameGrupo: (oldName: string, newName: string) => Promise<void>
  onRenameSubgrupo: (grupo: string, oldName: string, newName: string) => Promise<void>
}

interface TreeStructure {
  [grupo: string]: {
    [subgrupo: string]: Categoria[]
  }
}

function buildTree(categorias: Categoria[]): TreeStructure {
  const tree: TreeStructure = {}
  for (const c of categorias) {
    const g = c.grupo || 'Sin grupo'
    const sg = c.subgrupo || '(sin subgrupo)'
    if (!tree[g]) tree[g] = {}
    if (!tree[g][sg]) tree[g][sg] = []
    tree[g][sg].push(c)
  }
  return tree
}

function buildSubgruposMap(categorias: Categoria[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>()
  for (const c of categorias) {
    if (!c.subgrupo) continue
    if (!map.has(c.grupo)) map.set(c.grupo, new Set())
    map.get(c.grupo)!.add(c.subgrupo)
  }
  return new Map(Array.from(map.entries()).map(([k, v]) => [k, Array.from(v)]))
}

export function CategoriaTree({
  categorias, onCreate, onUpdate, onDelete, onRenameGrupo, onRenameSubgrupo,
}: Props) {
  const tree = buildTree(categorias)
  const subgruposMap = buildSubgruposMap(categorias)
  const grupos = Object.keys(tree).sort()
  const [expanded, setExpanded] = useState<Set<string>>(new Set(grupos))

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleRenameGrupo(oldName: string) {
    const newName = prompt(`Renombrar grupo "${oldName}" a:`, oldName)
    if (newName && newName !== oldName) await onRenameGrupo(oldName, newName)
  }

  async function handleRenameSubgrupo(grupo: string, oldName: string) {
    const newName = prompt(`Renombrar subgrupo "${oldName}" a:`, oldName)
    if (newName && newName !== oldName) await onRenameSubgrupo(grupo, oldName, newName)
  }

  async function handleDelete(cat: Categoria) {
    if (confirm(`¿Borrar categoría "${cat.nombre}"? Los movimientos asociados quedarán sin categoría.`)) {
      await onDelete(cat.id)
    }
  }

  return (
    <div className="space-y-2">
      {grupos.map(g => {
        const isExpanded = expanded.has(g)
        const subgrupos = Object.keys(tree[g]).sort()
        const totalCount = subgrupos.reduce((s, sg) => s + tree[g][sg].length, 0)

        return (
          <div key={g} className="bg-card border border-border rounded-xl overflow-hidden">
            <div
              className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30"
              onClick={() => toggle(g)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-semibold text-sm flex-1">{g}</span>
              <span className="text-xs text-muted-foreground">{totalCount} categorías</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleRenameGrupo(g) }}
                className="h-6 w-6 p-0"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>

            {isExpanded && (
              <div className="px-2 pb-2 space-y-1">
                {subgrupos.map(sg => {
                  const sgKey = `${g}::${sg}`
                  const sgExpanded = expanded.has(sgKey)
                  const cats = tree[g][sg]
                  return (
                    <div key={sgKey} className="ml-4">
                      <div
                        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30 rounded"
                        onClick={() => toggle(sgKey)}
                      >
                        {sgExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <span className="text-xs font-medium flex-1">{sg}</span>
                        <span className="text-xs text-muted-foreground">{cats.length}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleRenameSubgrupo(g, sg) }}
                          className="h-6 w-6 p-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                      {sgExpanded && (
                        <div className="ml-6 space-y-1">
                          {cats.map(c => (
                            <div key={c.id} className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded">
                              <span className="text-lg">{c.icono}</span>
                              <span className="text-sm flex-1">{c.nombre}</span>
                              <CategoriaFormDialog
                                trigger={
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                }
                                categoria={c}
                                grupos={grupos}
                                subgruposPorGrupo={subgruposMap}
                                onSubmit={onUpdate}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(c)}
                                className="h-6 w-6 p-0 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <CategoriaFormDialog
        trigger={
          <Button variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" /> Nueva categoría
          </Button>
        }
        grupos={grupos}
        subgruposPorGrupo={subgruposMap}
        onSubmit={onCreate}
      />
    </div>
  )
}
