export interface AuthUser {
  id?: string;
  personalId?: string;
  role?: string;
  email?: string;
  displayName?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  authInitialized: boolean;
  userRole: string | null;
}

const defaultState: AuthState = {
  user: null,
  isAuthenticated: false,
  authInitialized: true,
  userRole: null,
};

export const useAuth = (): AuthState => defaultState;

export default useAuth;
