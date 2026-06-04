// persofinancia/supabase/functions/ingest-emails/parsers/rappicard.ts
//
// Parser para emails de RappiCard.
//
// Patrón típico del snippet:
//   "¡Hola, NOMBRE! Realizaste una compra con tu RappiCard.
//    Detalle de tu transacción: Monto $X.XXX[,XX] Método de pago *XXXX
//    No. de autorización XXXXXX Comercio NOMBRE Fecha de la transacción ..."
//
// El snippet no incluye fecha parseable, así que usamos `emailDate` como fecha.
import type { BankParser, ParsedTransaction } from './types.ts'

function parseMonto(snippet: string): number {
  const match = snippet.match(/Monto\s*\$\s?([\d.,]+)/i)
  if (!match) return 0
  let s = match[1]
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/\./g, '')
  }
  return parseFloat(s) || 0
}

function emailDateToBogota(emailDate?: string): { fecha: string; hora: string } {
  const d = emailDate ? new Date(emailDate) : new Date()
  // Bogotá = UTC-5
  const bog = new Date(d.getTime() - 5 * 60 * 60 * 1000)
  const fecha = `${bog.getUTCFullYear()}-${String(bog.getUTCMonth() + 1).padStart(2, '0')}-${String(bog.getUTCDate()).padStart(2, '0')}`
  const hora = `${String(bog.getUTCHours()).padStart(2, '0')}:${String(bog.getUTCMinutes()).padStart(2, '0')}`
  return { fecha, hora }
}

export class RappiCardParser implements BankParser {
  parse(snippet: string, messageId: string, emailDate?: string): ParsedTransaction | null {
    // Compra: "Realizaste una compra con tu RappiCard"
    if (/Realizaste una compra con tu RappiCard/i.test(snippet)) {
      const monto = parseMonto(snippet)
      if (!monto) return null
      const { fecha, hora } = emailDateToBogota(emailDate)
      const comercioMatch = snippet.match(/Comercio\s+(.+?)(?:\s+Fecha|\s+Hora|$)/i)
      const descripcion = (comercioMatch?.[1] ?? 'COMPRA RAPPICARD').trim().toUpperCase()
      const cuentaMatch = snippet.match(/M[eé]todo de pago\s+\*(\d+)/i)
      const cuenta = cuentaMatch ? `*${cuentaMatch[1]}` : null
      return {
        id: messageId, fecha, hora, tipo: 'Compra', flujo: 'out', monto,
        descripcion, cuenta, raw: snippet,
      }
    }

    // Pago de extracto (entra como abono en la tarjeta)
    if (/pago.+RappiCard|abono|extracto.+pagado/i.test(snippet) && !/extracto del mes|llegó el extracto/i.test(snippet)) {
      const monto = parseMonto(snippet)
      if (!monto) return null
      const { fecha, hora } = emailDateToBogota(emailDate)
      return {
        id: messageId, fecha, hora, tipo: 'Pago', flujo: 'in', monto,
        descripcion: 'PAGO RAPPICARD', cuenta: null, raw: snippet,
      }
    }

    // Extracto mensual, promociones, etc. — ignorar
    return null
  }
}
