// persofinancia/supabase/functions/ingest-emails/parsers/types.ts
export interface ParsedTransaction {
  id: string        // Gmail message ID (idempotence PK)
  fecha: string     // YYYY-MM-DD
  hora: string      // HH:MM
  tipo: string      // Compra / Transferencia / Ingreso / etc.
  flujo: 'in' | 'out'
  monto: number     // COP, always positive
  descripcion: string
  cuenta: string | null  // e.g. '*4000'
  raw: string       // original email snippet
}

export interface BankParser {
  parse(snippet: string, messageId: string): ParsedTransaction | null
}
