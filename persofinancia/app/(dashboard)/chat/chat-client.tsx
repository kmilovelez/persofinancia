// persofinancia/app/(dashboard)/chat/chat-client.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Msg {
  id?: number
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

const SUGGESTIONS = [
  '¿Cuánto gasté este mes?',
  '¿En qué categoría gasto más?',
  '¿Cuánto pago de Uber al mes?',
  'Top 5 gastos más grandes este año',
  '¿Voy bien con mi presupuesto?',
  'Compara mis gastos de mayo vs abril',
]

interface Props {
  initialMessages: Msg[]
}

export function ChatClient({ initialMessages }: Props) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    setError(null)
    const userMsg: Msg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error en chat')
        return
      }
      setMessages([...newMessages, { role: 'assistant', content: data.message }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  async function clearHistory() {
    if (!confirm('¿Borrar todo el historial de chat?')) return
    try {
      await fetch('/api/chat/clear', { method: 'POST' })
      setMessages([])
    } catch {
      // silent
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem-1rem)]">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Chat IA</h1>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg"
            aria-label="Borrar historial"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <p className="text-4xl">✨</p>
            <p className="text-sm text-muted-foreground">
              Pregúntame sobre tus finanzas. Tengo acceso a tus movimientos, categorías y presupuestos.
            </p>
            <div className="grid gap-2 max-w-xs mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm bg-muted/40 hover:bg-muted/70 rounded-lg px-3 py-2 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={cn(
              'flex',
              m.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Pensando…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center text-xs text-destructive py-2">{error}</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-3 bg-background">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Pregúntame sobre tus finanzas…"
            className="flex-1 bg-muted/40 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-primary text-primary-foreground rounded-full p-2 disabled:opacity-50 hover:bg-primary/90 transition-colors"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
