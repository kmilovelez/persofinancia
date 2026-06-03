/**
 * Quick test for Gemini API key + classification prompt.
 *
 * Reads GEMINI_API_KEY from .env.local and runs a sample classification.
 *
 * Usage:
 *   node scripts/test-gemini.mjs
 */
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not in .env.local')
  process.exit(1)
}

console.log(`✓ API key present: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`)

const prompt = `Eres un clasificador de movimientos financieros personales colombianos.

Categorías disponibles del usuario:
- Inversiones (grupo: Ahorro)
- Deuda (grupo: Fijo)
- Pagos/Servicios (grupo: Fijo)
- Suscripciones/Tech (grupo: Fijo)
- Domicilios/Comida (grupo: Variable)
- Mercado/Hogar (grupo: Variable)
- Transporte/Gasolina (grupo: Variable)
- Otros (grupo: Variable)

Ejemplos previos del usuario:
- "RAPPI" (Compra, $25000) → Domicilios/Comida
- "STARBUCKS" (Compra, $18000) → Domicilios/Comida

Movimiento a clasificar:
- Descripción: "JUAN VALDEZ CAFE"
- Tipo: Compra
- Monto: $32000 COP
- Flujo: salida/gasto
- Banco: Bancolombia

Devuelve JSON con la categoría más probable (nombre exacto de la lista) y tu confianza:
{"categoria": "nombre exacto", "confianza": 0-100}

Si no estás seguro o el movimiento es ambiguo, usa confianza baja (< 70).`

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
console.log(`→ Calling ${url.replace(apiKey, '***')}`)

const t0 = Date.now()
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 200,
      responseMimeType: 'application/json',
    },
  }),
})
const elapsed = Date.now() - t0
console.log(`← ${res.status} ${res.statusText} (${elapsed}ms)`)

const bodyText = await res.text()
console.log('\n--- Raw response body ---')
console.log(bodyText)

if (!res.ok) {
  console.error('\n❌ API call failed')
  process.exit(1)
}

const data = JSON.parse(bodyText)
const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
console.log('\n--- Extracted text ---')
console.log(text)

const jsonMatch = text.match(/\{[\s\S]+\}/)
if (jsonMatch) {
  console.log('\n--- Parsed JSON ---')
  console.log(JSON.parse(jsonMatch[0]))
}
