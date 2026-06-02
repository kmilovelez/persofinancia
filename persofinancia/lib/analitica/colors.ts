// persofinancia/lib/analitica/colors.ts
'use client'
import { useEffect, useState } from 'react'

export interface ChartColors {
  income: string
  expense: string
  debt: string
  primary: string
  muted: string
  grid: string
  text: string
  background: string
  palette: string[]
}

const LIGHT_PALETTE = [
  '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899',
  '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#84cc16',
]

const DARK_PALETTE = [
  '#60a5fa', '#4ade80', '#fb923c', '#c084fc', '#f472b6',
  '#2dd4bf', '#facc15', '#f87171', '#22d3ee', '#a3e635',
]

function readCSSVar(varName: string): string {
  if (typeof window === 'undefined') return ''
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value ? `hsl(${value})` : ''
}

function isDark(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>({
    income: '#22c55e',
    expense: '#ef4444',
    debt: '#3b82f6',
    primary: '#3b82f6',
    muted: '#94a3b8',
    grid: '#e2e8f0',
    text: '#0f172a',
    background: '#ffffff',
    palette: LIGHT_PALETTE,
  })

  useEffect(() => {
    function compute() {
      const dark = isDark()
      setColors({
        income: readCSSVar('--income') || (dark ? '#4ade80' : '#22c55e'),
        expense: readCSSVar('--expense') || (dark ? '#f87171' : '#ef4444'),
        debt: readCSSVar('--debt') || (dark ? '#60a5fa' : '#3b82f6'),
        primary: readCSSVar('--primary') || (dark ? '#60a5fa' : '#3b82f6'),
        muted: readCSSVar('--muted-foreground') || (dark ? '#94a3b8' : '#64748b'),
        grid: readCSSVar('--border') || (dark ? '#334155' : '#e2e8f0'),
        text: readCSSVar('--foreground') || (dark ? '#f1f5f9' : '#0f172a'),
        background: readCSSVar('--background') || (dark ? '#0f172a' : '#ffffff'),
        palette: dark ? DARK_PALETTE : LIGHT_PALETTE,
      })
    }

    compute()

    const observer = new MutationObserver(compute)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return colors
}
