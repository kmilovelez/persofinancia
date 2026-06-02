// persofinancia/supabase/functions/ingest-emails/parsers/bancolombia.ts
import type { BankParser, ParsedTransaction } from './types.ts'

function parseMonto(raw: string): number {
  const match = raw.match(/\$\s?([\d.,]+)/)
  if (!match) return 0
  let s = match[1]
  if (s.includes(',')) {
    // Format: 167.980,00 (thousands dot, decimal comma)
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    const parts = s.split('.')
    if (parts.length === 2 && parts[1].length <= 2) {
      // decimal dot: 8439292.00
    } else {
      // thousands dot: 167.980
      s = s.replace(/\./g, '')
    }
  }
  return parseFloat(s) || 0
}

function parseFechaHora(snippet: string): { fecha: string; hora: string } {
  const match = snippet.match(/el (\d{2})\/(\d{2})\/(\d{2,4}) a las (\d{2}:\d{2})/i)
  if (!match) {
    const d = new Date()
    return {
      fecha: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
      hora: '00:00',
    }
  }
  const [, day, month, year, hora] = match
  const fullYear = year.length === 2 ? `20${year}` : year
  return { fecha: `${fullYear}-${month}-${day}`, hora }
}

export class BancolombiaParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const { fecha, hora } = parseFechaHora(snippet)
    const monto = parseMonto(snippet)
    if (!monto) return null

    // Compra con tarjeta débito
    const compra = snippet.match(/Compraste \$[\d.,]+ en (.+?) con tu T\.Deb/i)
    if (compra) {
      const cuentaMatch = snippet.match(/T\.Deb \*(\d+)/i)
      return {
        id: messageId, fecha, hora, tipo: 'Compra', flujo: 'out', monto,
        descripcion: compra[1].trim().toUpperCase(),
        cuenta: cuentaMatch ? `*${cuentaMatch[1]}` : null,
        raw: snippet,
      }
    }

    // Transferencia recibida
    if (/recibiste una transferencia de .+ por \$/i.test(snippet)) {
      const nombre = snippet.match(/transferencia de (.+?) por \$/i)?.[1]
      return {
        id: messageId, fecha, hora, tipo: 'Transferencia recibida', flujo: 'in', monto,
        descripcion: (nombre ?? 'TRANSFERENCIA').toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    // Ingreso / nómina
    if (/Recibiste un pago|de Nomina/i.test(snippet)) {
      const nombre = snippet.match(/(?:pago|Nomina) (?:de |)(.+?) por \$/i)?.[1]
      return {
        id: messageId, fecha, hora, tipo: 'Ingreso', flujo: 'in', monto,
        descripcion: (nombre ?? 'INGRESO').toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    // Pago QR / código QR
    const qr = snippet.match(/pagaste \$[\d.,]+ por c[oó]digo QR.+?llave (.+?)(?:\.|$)/i)
    if (qr) {
      return {
        id: messageId, fecha, hora, tipo: 'Pago QR', flujo: 'out', monto,
        descripcion: `QR ${qr[1].trim().toUpperCase()}`, cuenta: null, raw: snippet,
      }
    }

    // Transferencia enviada / Bre-B
    if (/transferiste \$|Bre-B/i.test(snippet)) {
      const dest = snippet.match(/(?:transferiste \$[\d.,]+ |Bre-B.+?)a (.+?)(?:\s+desde|$)/i)?.[1]
      return {
        id: messageId, fecha, hora, tipo: 'Transferencia', flujo: 'out', monto,
        descripcion: (dest ?? 'TRANSFERENCIA').toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    // Pago a nombre desde producto
    const pago = snippet.match(/Pagaste \$[\d.,]+ a (.+?) desde tu producto/i)
    if (pago) {
      return {
        id: messageId, fecha, hora, tipo: 'Pago', flujo: 'out', monto,
        descripcion: pago[1].trim().toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    return null
  }
}
