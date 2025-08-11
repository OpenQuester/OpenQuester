import { authApi } from "@/api/auth";
import { UNAUTHORIZED_EVENT } from "@/api/client";
import { type PermissionValue } from "@/constants/permissions";
import { type UserDTO } from "@/types/dto";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: UserDTO | null;
  isLoading: boolean; // true only during initial /me fetch
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // initial bootstrap only
  const initRef = useRef(false);
  const navigate = useNavigate();

  // Initial auth bootstrap (guarded for React Strict re-run)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void checkAuth();
  }, []);

  // Listen once globally for forced logout (401 anywhere)
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      if (window.location.pathname.endsWith("/forbidden")) return; // avoid loop
      navigate("/forbidden", {
        replace: true,
        state: { from: window.location.pathname },
      });
    };
    window.addEventListener(
      UNAUTHORIZED_EVENT,
      handleUnauthorized as EventListener
    );
    return () =>
      window.removeEventListener(
        UNAUTHORIZED_EVENT,
        handleUnauthorized as EventListener
      );
  }, []);

  const checkAuth = async (): Promise<void> => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (permission: string | PermissionValue): boolean => {
    const target = permission as string;
    return (
      !user?.isBanned && !!user?.permissions?.some((p) => p.name === target)
    );
  };

  const isAuthenticated = !!user;

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
