import { createDirectClient } from './supabase-direct'

export interface AuditLogEntry {
  userId?: string
  userEmail?: string
  userName?: string
  actionType: 'create' | 'update' | 'delete' | 'status_change' | 'assign' | 'unassign' | 'other'
  entityType: 'application' | 'address' | 'user' | 'other'
  entityId?: string
  description: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Записывает действие в журнал аудита
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createDirectClient()

    const auditData = {
      user_id: entry.userId || null,
      user_email: entry.userEmail || null,
      user_name: entry.userName || null,
      action_type: entry.actionType,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      description: entry.description,
      old_values: entry.oldValues || null,
      new_values: entry.newValues || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
    }

    // Обходим проблемы с автогенерируемыми типами Supabase через unknown
    const table = supabase.from('zakaz_audit_log') as unknown
    const builder = (table as { insert: (data: Record<string, unknown>) => Promise<unknown> }).insert(auditData)
    const result = await builder
    const { error } = result as { error: unknown }

    if (error) {
      console.error('Failed to write audit log:', error)
      // Не бросаем ошибку, чтобы не прерывать основное действие
    }
  } catch (error) {
    console.error('Error writing audit log:', error)
    // Не бросаем ошибку, чтобы не прерывать основное действие
  }
}

/**
 * Получает IP адрес из request
 */
export function getClientIP(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return realIp || undefined
}

/**
 * Получает User-Agent из request
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}
