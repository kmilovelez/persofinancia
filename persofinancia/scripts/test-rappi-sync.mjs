import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })
const url = `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co/functions/v1/ingest-emails`
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: '2026-05-15', to: '2026-06-04', user_id: '176c3601-8f07-4cf7-9c98-ce89d06cda76' }),
})
const data = await res.json()
console.log(JSON.stringify(data, null, 2))
