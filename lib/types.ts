export type UserRole = 'admin' | 'manager' | 'engineer' | 'installer' | 'supply' | 'director' | 'accountant' | 'support' | 'maintenance' | 'approval'

export type ApplicationStatus =
  | 'new'
  | 'thinking'
  | 'estimation'
  | 'contract'
  | 'design'
  | 'approval'
  | 'queue_install'
  | 'install'
  | 'installed'
  | 'rejected'
  | 'no_tech'

export type Urgency = 'low' | 'normal' | 'high' | 'critical'

export type CustomerType = 'individual' | 'business'

export type ServiceType = 'apartment' | 'office' | 'scs'

export type NodeStatus = 'existing' | 'planned' | 'not_present'

export type NodeType = 'prp' | 'ao' | 'sk' | 'other'

export type PresenceType = 'has_node' | 'has_ao' | 'has_transit_cable' | 'not_present'

export type AddressPresenceStatus = 'has_node' | 'has_ao' | 'has_transit_cable' | 'collecting_collective' | 'not_present'

export type AddressMatchStatus = 'unmatched' | 'auto_matched' | 'manual_matched'

export interface User {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  active: boolean
  created_at: string
  updated_at: string
  // Legacy-поля для импорта из старой системы
  legacy_uid: number | null
  legacy_last_access: string | null
  legacy_last_login: string | null
}

export interface Application {
  id: string
  address_id: string | null
  node_id: string | null
  city: string
  street_and_house: string | null
  address_details: string | null
  address_match_status: AddressMatchStatus
  customer_type: CustomerType
  customer_fullname: string
  customer_phone: string
  contact_person: string | null
  contact_phone: string | null
  status: ApplicationStatus
  urgency: Urgency
  client_comment: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
  service_type: ServiceType
  application_number: number
  assigned_to: string | null
  // Legacy-поля для импорта из старой системы
  legacy_id: number | null
  legacy_stage: string | null
  // Оригинальные адреса (backup для сравнения с нормализованными)
  street_and_house_original: string | null
  address_details_original: string | null
}

export interface ApplicationStatusInfo {
  id: string
  code: ApplicationStatus
  name_ru: string
  description_ru: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  application_id: string
  user_id: string | null
  user_name: string
  user_email: string | null
  comment: string
  reply_to_comment_id: string | null
  created_at: string
  updated_at: string
  // Legacy-поле для импорта из старой системы
  legacy_id: number | null
}

export interface FileAttachment {
  id: string
  application_id: string
  comment_id: string | null
  original_filename: string
  stored_filename: string
  file_size: number
  mime_type: string
  uploaded_by: string | null  // nullable для legacy-записей
  uploaded_at: string
  description: string | null
  // Legacy-поля для импорта из старой системы
  legacy_id: number | null
  legacy_path: string | null
}

export interface Address {
  id: string
  city: string
  street: string | null
  house: string | null
  building: string | null
  address: string
  comment: string | null
  presence_status: AddressPresenceStatus
  created_at: string
  updated_at: string
}

export interface Node {
  id: string
  code: string
  // Новая структура (после миграции 028) - опциональное для обратной совместимости
  address_id?: string
  // Старая структура (до миграции 028) - опциональные для обратной совместимости
  city?: string | null
  street?: string | null
  house?: string | null
  building?: string | null
  address?: string
  comment?: string | null
  // Остальные поля
  node_type: NodeType
  presence_type: PresenceType
  location_details: string | null
  comm_info: string | null
  status: NodeStatus
  contract_link: string | null
  node_created_date: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      zakaz_users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
      }
      zakaz_addresses: {
        Row: Address
        Insert: Omit<Address, 'id' | 'created_at' | 'updated_at' | 'address'>
        Update: Partial<Omit<Address, 'id' | 'created_at' | 'updated_at' | 'address'>>
      }
      zakaz_applications: {
        Row: Application
        Insert: Omit<Application, 'id' | 'created_at' | 'updated_at' | 'application_number'>
        Update: Partial<Omit<Application, 'id' | 'created_at' | 'updated_at' | 'application_number'>>
      }
      zakaz_application_statuses: {
        Row: ApplicationStatusInfo
        Insert: Omit<ApplicationStatusInfo, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ApplicationStatusInfo, 'id' | 'created_at' | 'updated_at'>>
      }
      zakaz_files: {
        Row: FileAttachment
        Insert: Omit<FileAttachment, 'id' | 'uploaded_at'>
        Update: Partial<Omit<FileAttachment, 'id' | 'uploaded_at'>>
      }
      zakaz_application_comments: {
        Row: Comment
        Insert: Omit<Comment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Comment, 'id' | 'created_at' | 'updated_at'>>
      }
      zakaz_nodes: {
        Row: Node
        Insert: Omit<Node, 'id' | 'created_at' | 'updated_at' | 'node_type'>
        Update: Partial<Omit<Node, 'id' | 'created_at' | 'updated_at' | 'node_type'>>
      }
    }
  }
}
