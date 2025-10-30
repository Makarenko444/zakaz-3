export type UserRole = 'admin' | 'operator' | 'engineer' | 'lead'

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
  customer_type: CustomerType
  customer_fullname: string
  customer_phone: string
  responsible_fullname: string | null
  responsible_phone: string | null
  status: ApplicationStatus
  urgency: Urgency
  client_comment: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  service_type: ServiceType
  application_number: number
  assigned_to: string | null
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
    }
  }
}
