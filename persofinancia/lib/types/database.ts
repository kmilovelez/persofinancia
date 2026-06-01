export type FlowType = 'in' | 'out'
export type ThemeType = 'dark' | 'light' | 'system'
export type MovimientoOrigen = 'email' | 'csv' | 'manual'
export type ReglaOrigen = 'manual' | 'ai_suggestion'
export type ReglaOperador = 'contains' | 'starts_with' | 'equals' | 'gt' | 'lt'
export type ReglaCampo = 'descripcion' | 'monto' | 'tipo' | 'banco'

export interface Profile {
  user_id: string
  nombre: string
  email: string
  tema: ThemeType
  gmail_token: string | null
  created_at: string
}

export interface Banco {
  id: string
  user_id: string
  nombre: string
  icono: string
  gmail_query: string
  parser_type: string
  parser_config: Record<string, unknown>
  activo: boolean
  ultimo_sync: string | null
  created_at: string
}

export interface Movimiento {
  id: string
  user_id: string
  banco_id: string | null
  fecha: string           // YYYY-MM-DD
  hora: string            // HH:MM
  tipo: string
  flujo: FlowType
  monto: number
  descripcion: string
  categoria: string | null
  categoria_manual: boolean
  regla_aplicada: string | null
  confianza_ia: number | null
  origen: MovimientoOrigen
  cuenta: string | null
  raw: string | null
  created_at: string
}

export interface Categoria {
  id: string
  user_id: string
  nombre: string
  grupo: string
  subgrupo: string
  icono: string
  color: string
}

export interface ReglaCategoria {
  id: string
  user_id: string
  categoria_id: string
  campo: ReglaCampo
  operador: ReglaOperador
  valor: string
  prioridad: number
  activa: boolean
  origen: ReglaOrigen
  aplicaciones: number
  created_at: string
}

export interface Alerta {
  id: string
  user_id: string
  tipo: 'critica' | 'advertencia' | 'sugerencia'
  titulo: string
  mensaje: string
  leida: boolean
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'> & { gmail_token?: string | null }; Update: Partial<Profile> }
      bancos: { Row: Banco; Insert: Omit<Banco, 'id' | 'created_at'>; Update: Partial<Banco> }
      movimientos: { Row: Movimiento; Insert: Omit<Movimiento, 'id' | 'created_at'>; Update: Partial<Movimiento> }
      categorias: { Row: Categoria; Insert: Omit<Categoria, 'id'>; Update: Partial<Categoria> }
      reglas_categoria: { Row: ReglaCategoria; Insert: Omit<ReglaCategoria, 'id' | 'aplicaciones' | 'created_at'>; Update: Partial<ReglaCategoria> }
      alertas: { Row: Alerta; Insert: Omit<Alerta, 'id' | 'created_at'>; Update: Partial<Alerta> }
    }
  }
}
