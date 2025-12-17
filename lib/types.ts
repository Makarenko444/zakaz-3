export type UserRole = 'admin' | 'manager' | 'engineer' | 'installer' | 'supply' | 'director' | 'accountant' | 'support' | 'maintenance' | 'approval'

export type ApplicationStatus =
  | 'new'
  | 'thinking'
  | 'estimation'
  | 'estimation_done'
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

export type ServiceType = 'apartment' | 'office' | 'scs' | 'emergency'

export type NodeStatus = 'existing' | 'planned' | 'not_present'

export type NodeType = 'prp' | 'ao' | 'sk' | 'other'

export type PresenceType = 'has_node' | 'has_ao' | 'has_transit_cable' | 'not_present'

export type AddressPresenceStatus = 'has_node' | 'has_ao' | 'has_transit_cable' | 'collecting_collective' | 'not_present'

export type AddressMatchStatus = 'unmatched' | 'auto_matched' | 'manual_matched'

// Типы для нарядов (work orders)
export type WorkOrderType = 'survey' | 'installation'

export type WorkOrderStatus = 'draft' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'

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
  technical_curator_id: string | null
  // Legacy-поля для импорта из старой системы
  legacy_id: number | null
  legacy_stage: string | null
  legacy_body: string | null
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
  work_order_id: string | null  // ссылка на наряд
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

// Справочник материалов
export interface Material {
  id: string
  code: string | null // Код из 1С
  name: string
  unit: string
  category: string | null
  price: number // Цена за единицу
  stock_quantity: number // Общий остаток (сумма по всем складам)
  stocks_by_warehouse?: Array<{ warehouse_id: string; warehouse_name: string; quantity: number }> // Остатки по складам
  activity_level: number // 1=популярный, 2=иногда, 3=редко, 4=архив
  is_active: boolean
  sort_order: number
  last_import_at: string | null // Дата последнего импорта
  created_at: string
  updated_at: string
}

// Склад
export interface Warehouse {
  id: string
  name: string
  code: string | null
  address: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// Остаток материала на складе
export interface WarehouseStock {
  id: string
  warehouse_id: string
  material_id: string
  quantity: number
  last_import_at: string | null
  created_at: string
  updated_at: string
  warehouse?: Warehouse
  material?: Material
}

// Шаблон материалов
export interface MaterialTemplate {
  id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  items?: MaterialTemplateItem[]
}

// Позиция в шаблоне материалов
export interface MaterialTemplateItem {
  id: string
  template_id: string
  material_id: string | null
  material_name: string
  unit: string
  quantity: number
  notes: string | null
  sort_order: number
  created_at: string
}

// Наряд на работы
export interface WorkOrder {
  id: string
  work_order_number: number
  application_id: string
  type: WorkOrderType
  status: WorkOrderStatus
  scheduled_date: string | null
  scheduled_time: string | null
  estimated_duration: string | null // interval как строка, например "4 hours"
  actual_start_at: string | null
  actual_end_at: string | null
  notes: string | null
  result_notes: string | null
  customer_signature: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// Расширенный наряд с связанными данными
export interface WorkOrderWithDetails extends WorkOrder {
  application?: Application
  executors?: WorkOrderExecutor[]
  materials?: WorkOrderMaterial[]
}

// Исполнитель наряда
export interface WorkOrderExecutor {
  id: string
  work_order_id: string
  user_id: string
  is_lead: boolean
  created_at: string
  // Связанные данные
  user?: User
}

// Материал наряда (расход)
export interface WorkOrderMaterial {
  id: string
  work_order_id: string
  material_id: string | null
  material_name: string
  unit: string
  quantity: number
  notes: string | null
  created_at: string
}

// История статусов наряда
export interface WorkOrderStatusHistory {
  id: string
  work_order_id: string
  old_status: WorkOrderStatus | null
  new_status: WorkOrderStatus
  changed_by: string | null
  comment: string | null
  changed_at: string
  // Связанные данные
  user?: User
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
      zakaz_materials: {
        Row: Material
        Insert: Omit<Material, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Material, 'id' | 'created_at' | 'updated_at'>>
      }
      zakaz_work_orders: {
        Row: WorkOrder
        Insert: Omit<WorkOrder, 'id' | 'created_at' | 'updated_at' | 'work_order_number'>
        Update: Partial<Omit<WorkOrder, 'id' | 'created_at' | 'updated_at' | 'work_order_number'>>
      }
      zakaz_work_order_executors: {
        Row: WorkOrderExecutor
        Insert: Omit<WorkOrderExecutor, 'id' | 'created_at'>
        Update: Partial<Omit<WorkOrderExecutor, 'id' | 'created_at'>>
      }
      zakaz_work_order_materials: {
        Row: WorkOrderMaterial
        Insert: Omit<WorkOrderMaterial, 'id' | 'created_at'>
        Update: Partial<Omit<WorkOrderMaterial, 'id' | 'created_at'>>
      }
      zakaz_work_order_status_history: {
        Row: WorkOrderStatusHistory
        Insert: Omit<WorkOrderStatusHistory, 'id' | 'changed_at'>
        Update: Partial<Omit<WorkOrderStatusHistory, 'id' | 'changed_at'>>
      }
    }
  }
}
