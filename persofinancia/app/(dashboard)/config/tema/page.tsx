import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function TemaPage() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4 pt-4">Apariencia</h1>
      <Card>
        <CardHeader>
          <CardTitle>Tema de color</CardTitle>
          <CardDescription>Elige como quieres ver la app</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  )
}
