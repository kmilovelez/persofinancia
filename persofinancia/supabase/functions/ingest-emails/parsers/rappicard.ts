// persofinancia/supabase/functions/ingest-emails/parsers/rappicard.ts
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

export class RappiCardParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const monto = parseMonto(snippet)
    if (!monto) return null

    if (/compra|compras/i.test(snippet)) {
      const comercio = snippet.match(/(?:en|de) (.+?)(?:\s+por|\s+\$|\.|$)/i)?.[1]
      return { id: messageId, fecha: todayStr(), hora: '00:00', tipo: 'Compra TC', flujo: 'out',
        monto, descripcion: (comercio ?? 'RAPPICARD').toUpperCase(), cuenta: null, raw: snippet }
    }
    if (/pago/i.test(snippet)) {
      return { id: messageId, fecha: todayStr(), hora: '00:00', tipo: 'Pago TC', flujo: 'in',
        monto, descripcion: 'PAGO RAPPICARD', cuenta: null, raw: snippet }
    }
    return null
  }
}
