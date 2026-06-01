'use client'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const OPTIONS = [
  { value: 'light',  label: 'Claro',   icon: Sun },
  { value: 'dark',   label: 'Oscuro',  icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="flex gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={theme === value ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTheme(value)}
          className="flex-1"
        >
          <Icon className="h-4 w-4 mr-1" />
          {label}
        </Button>
      ))}
    </div>
  )
}
