
import React, { useState, useEffect } from 'react';
import { Shield, Settings, Users, Save, RotateCcw, AlertTriangle, Check } from 'lucide-react';
import { usePermissions, Permission, Role } from '../contexts/PermissionsContext';

interface RolePermissions {
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  updatedAt: Date;
}

const PERMISSION_LABELS: Record<Permission, string> = {
  'view_dashboard': 'მთავარი დაფა',
  'manage_users': 'მომხმარებლების მართვა',
  'manage_roles': 'როლების მართვა',
  'manage_cottages': 'კოტეჯების მართვა',
  'manage_hotels': 'სასტუმროების მართვა',
  'manage_vehicles': 'ავტომობილების მართვა',
  'manage_bookings': 'ყველა ჯავშნის მართვა',
  'view_bookings': 'ჯავშნების ნახვა',
  'manage_customers': 'მომხმარებლების მართვა',
  'view_logs': 'ლოგების ნახვა',
  'manage_bank_accounts': 'ბანკის ანგარიშების მართვა',
  'view_analytics': 'ანალიტიკა',
  'manage_providers': 'პროვაიდერების მართვა',
  'view_own_bookings': 'საკუთარი ჯავშნების ნახვა',
  'create_booking': 'ჯავშნის შექმნა',
  'view_calendar': 'კალენდრის ნახვა',
  'manage_pricing': 'ფასების მართვა',
  'view_financial_reports': 'ფინანსური რეპორტები',
  'manage_seasonal_pricing': 'სეზონური ფასების მართვა',
  'manage_reviews': 'შეფასებების მართვა',
  'view_customer_profile': 'მომხმარებლის პროფილი',
  'switch_to_customer_view': 'მომხმარებლის ხედვაზე გადართვა'
};

const ROLE_LABELS: Record<Role, string> = {
  'SUPER_ADMIN': 'სუპერ ადმინისტრატორი',
  'ADMIN': 'ადმინისტრატორი',
  'PROVIDER_ADMIN': 'პროვაიდერი',
  'CUSTOMER': 'მომხმარებელი'
};

const PERMISSION_CATEGORIES = {
  'core': {
    label: 'ძირითადი',
    permissions: ['view_dashboard', 'view_calendar', 'view_customer_profile'] as Permission[]
  },
  'management': {
    label: 'მართვა',
    permissions: ['manage_users', 'manage_roles', 'manage_cottages', 'manage_hotels', 'manage_vehicles', 'manage_customers', 'manage_providers'] as Permission[]
  },
  'bookings': {
    label: 'ჯავშნები',
    permissions: ['manage_bookings', 'view_bookings', 'view_own_bookings', 'create_booking'] as Permission[]
  },
  'financial': {
    label: 'ფინანსური',
    permissions: ['manage_bank_accounts', 'view_financial_reports', 'manage_pricing', 'manage_seasonal_pricing'] as Permission[]
  },
  'system': {
    label: 'სისტემა',
    permissions: ['view_logs', 'view_analytics', 'manage_reviews', 'switch_to_customer_view'] as Permission[]
  }
};

const RolePermissionsPage: React.FC = () => {
  const { hasPermission, getAllRolePermissions, updateRolePermissions, resetRoleToDefaults } = usePermissions();
  const [rolePermissions, setRolePermissions] = useState<RolePermissions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedRole, setExpandedRole] = useState<Role | null>(null);
  const [localPermissions, setLocalPermissions] = useState<Record<Role, Permission[]>>({} as Record<Role, Permission[]>);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Check permissions
  if (!hasPermission('manage_roles')) {
    return (
      <div className="p-8">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">წვდომა შეზღუდულია</h3>
          <p className="text-gray-500">თქვენ არ გაქვთ როლების მართვის უფლება</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadRolePermissions();
  }, []);

  const loadRolePermissions = async () => {
    try {
      setIsLoading(true);
      const permissions = await getAllRolePermissions();
      setRolePermissions(permissions);
      
      // Initialize local permissions
      const localPerms: Record<Role, Permission[]> = {} as Record<Role, Permission[]>;
      permissions.forEach(rp => {
        localPerms[rp.role] = [...rp.permissions];
      });
      setLocalPermissions(localPerms);
    } catch (error) {
      console.error('Error loading role permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionToggle = (role: Role, permission: Permission) => {
    setLocalPermissions(prev => {
      const current = prev[role] || [];
      const isCurrentlyEnabled = current.includes(permission);
      
      if (isCurrentlyEnabled) {
        return {
          ...prev,
          [role]: current.filter(p => p !== permission)
        };
      } else {
        return {
          ...prev,
          [role]: [...current, permission]
        };
      }
    });
  };

  const handleSaveRole = async (role: Role) => {
    try {
      setIsSaving(true);
      const permissions = localPermissions[role] || [];
      await updateRolePermissions(role, permissions);
      
      // Update local state
      setRolePermissions(prev => 
        prev.map(rp => 
          rp.role === role 
            ? { ...rp, permissions, updatedAt: new Date() }
            : rp
        )
      );
      
      setSuccessMessage(`როლი "${ROLE_LABELS[role]}" წარმატებით განახლდა`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving role permissions:', error);
      alert('შეცდომა როლის შენახვისას');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetRole = async (role: Role) => {
    if (!confirm(`დარწმუნებული ხართ, რომ გსურთ როლი "${ROLE_LABELS[role]}" საწყის მდგომარეობაში დაბრუნება?`)) {
      return;
    }

    try {
      setIsSaving(true);
      await resetRoleToDefaults(role);
      await loadRolePermissions();
      setSuccessMessage(`როლი "${ROLE_LABELS[role]}" საწყის მდგომარეობაში დაბრუნდა`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error resetting role:', error);
      alert('შეცდომა როლის გადაყენებისას');
    } finally {
      setIsSaving(false);
    }
  };

  const hasUnsavedChanges = (role: Role): boolean => {
    const current = rolePermissions.find(rp => rp.role === role);
    const local = localPermissions[role];
    
    if (!current || !local) return false;
    
    return JSON.stringify(current.permissions.sort()) !== JSON.stringify(local.sort());
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">როლების ჩატვირთვა...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Settings className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-800">როლების მართვა</h1>
        </div>
        <p className="text-gray-600">
          მართეთ სხვადასხვა როლების უფლებები და წვდომები სისტემაში
        </p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <Check className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-800">{successMessage}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {rolePermissions.map((rolePermission) => (
          <div key={rolePermission.role} className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="w-6 h-6 text-blue-600 mr-3" />
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">
                      {ROLE_LABELS[rolePermission.role]}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {localPermissions[rolePermission.role]?.length || 0} უფლება მინიჭებული
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {hasUnsavedChanges(rolePermission.role) && (
                    <div className="flex items-center text-amber-600">
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      <span className="text-sm">არ არის შენახული</span>
                    </div>
                  )}
                  <button
                    onClick={() => setExpandedRole(expandedRole === rolePermission.role ? null : rolePermission.role)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {expandedRole === rolePermission.role ? 'დახურვა' : 'რედაქტირება'}
                  </button>
                </div>
              </div>
            </div>

            {expandedRole === rolePermission.role && (
              <div className="p-6">
                <div className="space-y-6">
                  {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                    <div key={categoryKey}>
                      <h4 className="text-lg font-semibold text-gray-700 mb-3">{category.label}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {category.permissions.map((permission) => (
                          <label key={permission} className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={localPermissions[rolePermission.role]?.includes(permission) || false}
                              onChange={() => handlePermissionToggle(rolePermission.role, permission)}
                              className="mr-3 h-4 w-4 text-blue-600 rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">{PERMISSION_LABELS[permission]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-200">
                  <button
                    onClick={() => handleResetRole(rolePermission.role)}
                    disabled={isSaving}
                    className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    საწყისი მდგომარეობა
                  </button>
                  
                  <button
                    onClick={() => handleSaveRole(rolePermission.role)}
                    disabled={isSaving || !hasUnsavedChanges(rolePermission.role)}
                    className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'შენახვა...' : 'შენახვა'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RolePermissionsPage;
