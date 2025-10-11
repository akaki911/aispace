export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'DEVELOPER' | 'PROVIDER_ADMIN' | 'PROVIDER' | 'CUSTOMER';

export type Permission =
  | 'view_dashboard'
  | 'manage_users'
  | 'manage_roles'
  | 'manage_cottages'
  | 'manage_hotels'
  | 'manage_vehicles'
  | 'manage_bookings'
  | 'view_bookings'
  | 'manage_customers'
  | 'view_logs'
  | 'manage_bank_accounts'
  | 'view_analytics'
  | 'manage_providers'
  | 'view_own_bookings'
  | 'create_booking'
  | 'view_calendar'
  | 'manage_pricing'
  | 'view_financial_reports'
  | 'manage_seasonal_pricing'
  | 'manage_reviews'
  | 'view_customer_profile'
  | 'switch_to_customer_view'
  | 'view_messaging'
  | 'send_messages'
  | 'create_support_conversations'
  | 'ai_developer_access'
  | 'view_gurulo_overview'
  | 'edit_gurulo_prompts'
  | 'manage_gurulo_users'
  | 'manage_gurulo_ui'
  | 'view_gurulo_analytics'
  | 'manage_gurulo_integrations'
  | 'view_ai_diagnostics';

export interface RolePermissions {
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  updatedAt: Date;
}

export interface PermissionsContextType {
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  isLoading: boolean;
  currentViewMode: 'admin' | 'customer';
  switchViewMode: (mode: 'admin' | 'customer') => void;
  canSwitchToCustomerView: boolean;
  getAllRolePermissions: () => Promise<RolePermissions[]>;
  updateRolePermissions: (role: Role, permissions: Permission[]) => Promise<void>;
  resetRoleToDefaults: (role: Role) => Promise<void>;
  refreshPermissions: () => Promise<void>;
  invalidateCache: () => void;
}
