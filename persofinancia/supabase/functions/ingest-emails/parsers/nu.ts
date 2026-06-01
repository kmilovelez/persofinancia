// persofinancia/supabase/functions/ingest-emails/parsers/nu.ts
import type { BankParser, ParsedTransaction } from './types.ts'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export class NuParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const m = snippet.match(/\$\s?([\d.,]+)/)
    if (!m) return null
    const monto = parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0
    if (!monto) return null
    const flujo: 'in' | 'out' = /recibiste|pago recibido/i.test(snippet) ? 'in' : 'out'
    return { id: messageId, fecha: todayStr(), hora: '00:00',
      tipo: flujo === 'in' ? 'Ingreso' : 'Compra', flujo, monto,
      descripcion: snippet.slice(0, 80).toUpperCase(), cuenta: null, raw: snippet }
  }
}
