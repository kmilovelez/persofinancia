// persofinancia/components/analitica/shared/chart-empty.tsx

interface ChartEmptyProps {
  title?: string
  description?: string
  icon?: string
}

export function ChartEmpty({
  title = 'Sin datos',
  description = 'Ajusta el rango o filtros para ver tus datos',
  icon = '📊',
}: ChartEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 text-muted-foreground">
      <span className="text-3xl mb-2">{icon}</span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs mt-1">{description}</p>
    </div>
  )
}
