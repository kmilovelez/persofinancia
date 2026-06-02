'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, Sparkles, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/',            label: 'Inicio',  icon: Home },
  { href: '/movimientos', label: 'Movs',    icon: List },
  { href: '/chat',        label: 'Chat IA', icon: Sparkles },
  { href: '/analitica',   label: 'Analisis', icon: BarChart2 },
  { href: '/config',      label: 'Config',  icon: Settings },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-0',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-xs font-medium truncate">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
