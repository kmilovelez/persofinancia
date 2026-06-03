// persofinancia/supabase/functions/ingest-emails/parsers/bancolombia.ts
//
// Parser robusto para emails de Bancolombia. Maneja todos los formatos detectados:
//
// FORMATOS DE FECHA:
//   - `el DD/MM/YYYY a las HH:MM`           (compras, transferencias clásicas)
//   - `el YYYY/MM/DD HH:MM`                 (transferencias QR)
//   - `DD/MM/YYYY HH:MM:SS`                 (Botón Bancolombia, sin "el")
//   - `el DD/MM/YYYY HH:MM:SS`              (pagos a producto, con segundos)
//
// TIPOS:
//   - Compra T.Deb         → out
//   - Transferencia clásica (desde cuenta a cuenta) → out
//   - Transferencia QR     → out
//   - Transferencia Boton Bancolombia → out
//   - Bre-B               → out
//   - Pago QR             → out
//   - Pago a NOMBRE desde producto → out
//   - Pago de Nomina      → in (Ingreso Nomina)
//   - Pago PROVEEDOR      → in (Ingreso Proveedor)
//   - Recibiste un pago   → in (Ingreso genérico)
//   - Transferencia recibida → in
import type { BankParser, ParsedTransaction } from './types.ts'

function parseMonto(raw: string): number {
  const match = raw.match(/\$\s?([\d.,]+)/)
  if (!match) return 0
  let s = match[1]
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    const parts = s.split('.')
    if (parts.length === 2 && parts[1].length <= 2) {
      // decimal
    } else {
      s = s.replace(/\./g, '')
    }
  }
  return parseFloat(s) || 0
}

/**
 * Parse fecha + hora from multiple Bancolombia formats.
 * Returns null if no format matches (caller should fallback or skip).
 */
function parseFechaHora(snippet: string): { fecha: string; hora: string } | null {
  // 1) "el DD/MM/YYYY a las HH:MM" — classic
  let m = snippet.match(/el (\d{2})\/(\d{2})\/(\d{2,4}) a las (\d{2}:\d{2})/i)
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3]
    return { fecha: `${year}-${m[2]}-${m[1]}`, hora: m[4] }
  }

  // 2) "el YYYY/MM/DD HH:MM" — QR transfers
  m = snippet.match(/el (\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2})/)
  if (m) {
    return { fecha: `${m[1]}-${m[2]}-${m[3]}`, hora: m[4] }
  }

  // 3) "el DD/MM/YYYY HH:MM:SS" — payments to producto with seconds
  m = snippet.match(/el (\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}):\d{2}/i)
  if (m) {
    return { fecha: `${m[3]}-${m[2]}-${m[1]}`, hora: m[4] }
  }

  // 4) "DD/MM/YYYY HH:MM:SS" — Boton Bancolombia (no "el" prefix)
  m = snippet.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}):\d{2}/)
  if (m) {
    return { fecha: `${m[3]}-${m[2]}-${m[1]}`, hora: m[4] }
  }

  // 5) "DD/MM/YYYY" alone (rare)
  m = snippet.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) {
    return { fecha: `${m[3]}-${m[2]}-${m[1]}`, hora: '00:00' }
  }

  return null
}

export class BancolombiaParser implements BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null {
    const fechaHora = parseFechaHora(snippet)
    if (!fechaHora) return null  // skip if can't determine date — better than wrong date

    const { fecha, hora } = fechaHora
    const monto = parseMonto(snippet)
    if (!monto) return null

    // ----- INGRESOS (in) -----

    // Ingreso PROVEEDOR (B2B) — detectar antes que nómina
    let m = snippet.match(/pago PROVEEDOR de (.+?) por \$/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Ingreso Proveedor', flujo: 'in', monto,
        descripcion: m[1].trim().toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    // Nómina
    m = snippet.match(/pago de Nomina de (.+?) por \$/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Ingreso Nomina', flujo: 'in', monto,
        descripcion: m[1].trim().toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    // Transferencia recibida
    m = snippet.match(/recibiste una transferencia de (.+?) por \$/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Transferencia recibida', flujo: 'in', monto,
        descripcion: m[1].trim().toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    // Ingreso genérico — "Recibiste un pago de NOMBRE"
    m = snippet.match(/Recibiste un pago (?:de )?(.+?) por \$/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Ingreso', flujo: 'in', monto,
        descripcion: m[1].trim().toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    // ----- GASTOS (out) -----

    // Compra con tarjeta débito
    m = snippet.match(/Compraste \$[\d.,]+ en (.+?) con tu T\.Deb/i)
    if (m) {
      const cuentaMatch = snippet.match(/T\.Deb \*(\d+)/i)
      return {
        id: messageId, fecha, hora, tipo: 'Compra', flujo: 'out', monto,
        descripcion: m[1].trim().toUpperCase(),
        cuenta: cuentaMatch ? `*${cuentaMatch[1]}` : null,
        raw: snippet,
      }
    }

    // Transferencia por Boton Bancolombia: "Transferiste $X por Boton Bancolombia a NOMBRE desde producto"
    m = snippet.match(/Transferiste \$[\d.,]+ por Bot[oó]n Bancolombia a (.+?) desde producto/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Transferencia Boton', flujo: 'out', monto,
        descripcion: m[1].trim().toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    // Transferencia por QR: "Transferiste $X por QR desde tu cuenta XXXX a la cuenta YYYY"
    m = snippet.match(/Transferiste \$[\d.,]+ por QR desde tu cuenta (\d+) a la cuenta (\d+)/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Transferencia QR', flujo: 'out', monto,
        descripcion: `QR a cuenta *${m[2]}`, cuenta: `*${m[1]}`, raw: snippet,
      }
    }

    // Transferencia clásica: "Transferiste $X desde tu cuenta *XXXX a la cuenta *YYYY el DD/MM/YYYY"
    m = snippet.match(/Transferiste \$[\d.,]+ desde tu cuenta \*?(\d+) a la cuenta \*?(\d+)/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Transferencia', flujo: 'out', monto,
        descripcion: `Cuenta *${m[2]}`, cuenta: `*${m[1]}`, raw: snippet,
      }
    }

    // Bre-B
    m = snippet.match(/Bre-B.+?a (.+?)(?:\s+desde|\.|$)/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Transferencia Bre-B', flujo: 'out', monto,
        descripcion: m[1].trim().toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    // Pago QR / código QR: "pagaste $X por codigo QR ... a la llave LLAVE"
    m = snippet.match(/pagaste \$[\d.,]+ por c[oó]digo QR.+?llave (.+?)(?:\.|$)/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Pago QR', flujo: 'out', monto,
        descripcion: `QR ${m[1].trim().toUpperCase()}`, cuenta: null, raw: snippet,
      }
    }

    // Pago a producto: "Pagaste $X a NOMBRE desde tu producto"
    m = snippet.match(/Pagaste \$[\d.,]+ a (.+?) desde tu producto/i)
    if (m) {
      return {
        id: messageId, fecha, hora, tipo: 'Pago', flujo: 'out', monto,
        descripcion: m[1].trim().toUpperCase(), cuenta: null, raw: snippet,
      }
    }

    return null
  }
}
