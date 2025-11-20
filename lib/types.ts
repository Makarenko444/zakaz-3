export type UserRole = 'admin' | 'manager' | 'engineer' | 'installer' | 'supply'

export type ApplicationStatus =
  | 'new'
  | 'thinking'
  | 'estimation'
  | 'waiting_payment'
  | 'contract'
  | 'queue_install'
  | 'install'
  | 'installed'
  | 'rejected'
  | 'no_tech'

export type Urgency = 'low' | 'normal' | 'high' | 'critical'

export type CustomerType = 'individual' | 'business'

export type ServiceType = 'apartment' | 'office' | 'scs'

export interface User {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  active: boolean
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  address_id: string | null
  street_and_house: string | null
  address_details: string | null
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

export interface FileAttachment {
  id: string
  application_id: string
  comment_id: string | null
  original_filename: string
  stored_filename: string
  file_size: number
  mime_type: string
  uploaded_by: string
  uploaded_at: string
  description: string | null
}

export interface Database {
  public: {
    Tables: {
      zakaz_users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
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
    }
  }
}
