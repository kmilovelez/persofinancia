// persofinancia/components/analitica/tabs/proyeccion-tab.tsx
import { ProjectionLine } from '../charts/projection-line'
import type { Movimiento } from '@/lib/types/database'

interface Props {
  movimientos: Movimiento[]
}

export function ProyeccionTab({ movimientos }: Props) {
  return (
    <div className="space-y-4">
      <ProjectionLine movimientos={movimientos} flujo="out" />
      <ProjectionLine movimientos={movimientos} flujo="in" />
    </div>
  )
}
