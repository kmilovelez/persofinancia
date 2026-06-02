// persofinancia/supabase/functions/ingest-emails/parsers/nequi.ts
import type { BankParser, ParsedTransaction } from './types.ts'

function parseMonto(snippet: string): number {
  const m = snippet.match(/\$\s?([\d.,]+)/)
  if (!m) return 0
  const s = m[1].includes(',')
    ? m[1].replace(/\./g, '').replace(',', '.')
    : m[1].replace(/\./g, '')
  return parseFloat(s) || 0
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export class NequiParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const monto = parseMonto(snippet)
    if (!monto) return null

    if (/enviaste|transferiste/i.test(snippet)) {
      const dest = snippet.match(/(?:enviaste|transferiste)[^a]*a (.+?)(?:\s+\$|\s+por|\.|$)/i)?.[1]
      return { id: messageId, fecha: todayStr(), hora: '00:00', tipo: 'Transferencia', flujo: 'out',
        monto, descripcion: (dest ?? 'NEQUI').toUpperCase(), cuenta: null, raw: snippet }
    }
    if (/recibiste/i.test(snippet)) {
      const origen = snippet.match(/recibiste[^d]*de (.+?)(?:\s+\$|\s+por|\.|$)/i)?.[1]
      return { id: messageId, fecha: todayStr(), hora: '00:00', tipo: 'Transferencia recibida', flujo: 'in',
        monto, descripcion: (origen ?? 'NEQUI').toUpperCase(), cuenta: null, raw: snippet }
    }
    if (/pagaste/i.test(snippet)) {
      const comercio = snippet.match(/pagaste[^a]*a (.+?)(?:\s+\$|\s+por|\.|$)/i)?.[1]
      return { id: messageId, fecha: todayStr(), hora: '00:00', tipo: 'Pago', flujo: 'out',
        monto, descripcion: (comercio ?? 'PAGO NEQUI').toUpperCase(), cuenta: null, raw: snippet }
    }
    return null
  }
}
