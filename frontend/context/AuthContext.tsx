"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type UserRole = "tourist" | "admin" | "superuser";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at?: string;
}

interface StoredLocalAccount extends AuthUser {
  password: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  adminTeam: AuthUser[];
  login: (email: string, password: string) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  logout: () => void;
  fetchAdminTeam: () => Promise<void>;
  addAdminMember: (email: string, password: string, fullName: string, role?: "admin" | "superuser") => Promise<{ success: boolean; error?: string }>;
}

const AUTH_SESSION_KEY = "trailweave_auth_session_v1";
const LOCAL_ACCOUNTS_KEY = "trailweave_local_user_accounts_v1";

const DEFAULT_SEEDED_ACCOUNTS: StoredLocalAccount[] = [
  {
    id: "user_superadmin_default",
    email: "admin@trailweave.org",
    password: "admin123",
    full_name: "TrailWeave SuperAdmin",
    role: "superuser",
    created_at: "2026-10-31T09:00:00Z",
  },
  {
    id: "user_tourist_demo",
    email: "tourist@trailweave.org",
    password: "tourist123",
    full_name: "Aarav Sharma",
    role: "tourist",
    created_at: "2026-10-31T09:30:00Z",
  },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminTeam, setAdminTeam] = useState<AuthUser[]>([
    {
      id: "user_superadmin_default",
      email: "admin@trailweave.org",
      full_name: "TrailWeave SuperAdmin",
      role: "superuser",
      created_at: "2026-10-31T09:00:00Z",
    },
  ]);

  const loadLocalAccounts = useCallback((): StoredLocalAccount[] => {
    try {
      const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredLocalAccount[];
        const emails = new Set(parsed.map((a) => a.email.toLowerCase()));
        const merged = [...parsed];
        for (const seed of DEFAULT_SEEDED_ACCOUNTS) {
          if (!emails.has(seed.email.toLowerCase())) {
            merged.push(seed);
          }
        }
        return merged;
      }
    } catch {}
    return [...DEFAULT_SEEDED_ACCOUNTS];
  }, []);

  const saveLocalAccounts = useCallback((accounts: StoredLocalAccount[]) => {
    try {
      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(AUTH_SESSION_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed?.user && parsed?.token) {
          setUser(parsed.user);
          setToken(parsed.token);
        }
      }
      const accounts = loadLocalAccounts();
      const admins = accounts
        .filter((a) => a.role === "admin" || a.role === "superuser")
        .map(({ password: _, ...rest }) => rest);
      if (admins.length > 0) {
        setAdminTeam(admins);
      }
    } catch {}
    setIsLoading(false);
  }, [loadLocalAccounts]);

  const persistSession = (authUser: AuthUser, authToken: string) => {
    setUser(authUser);
    setToken(authToken);
    try {
      localStorage.setItem(
        AUTH_SESSION_KEY,
        JSON.stringify({ user: authUser, token: authToken })
      );
    } catch {}
  };

  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> => {
      const normalizedEmail = email.trim().toLowerCase();
      const cleanedPassword = password.trim();

      if (!normalizedEmail || !cleanedPassword) {
        return { success: false, error: "Please enter both email and password." };
      }

      // 1. Try Backend Auth API
      try {
        const resp = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password: cleanedPassword }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const loggedInUser: AuthUser = {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.full_name,
            role: data.user.role,
            created_at: data.user.created_at,
          };
          persistSession(loggedInUser, data.access_token);
          return { success: true, user: loggedInUser };
        } else if (resp.status === 401) {
          // Check local accounts in case user registered offline
          const accounts = loadLocalAccounts();
          const localMatch = accounts.find(
            (a) => a.email.toLowerCase() === normalizedEmail && a.password === cleanedPassword
          );
          if (!localMatch) {
            return { success: false, error: "Invalid email or password." };
          }
        }
      } catch {
        // Fallback to local accounts below
      }

      // 2. Local fallback for offline/demo reliability
      const accounts = loadLocalAccounts();
      const match = accounts.find(
        (a) => a.email.toLowerCase() === normalizedEmail && a.password === cleanedPassword
      );
      if (!match) {
        return { success: false, error: "Invalid email or password." };
      }

      const authUser: AuthUser = {
        id: match.id,
        email: match.email,
        full_name: match.full_name,
        role: match.role,
        created_at: match.created_at,
      };
      const fallbackToken = `tw_local_token_${match.id}`;
      persistSession(authUser, fallbackToken);
      return { success: true, user: authUser };
    },
    [loadLocalAccounts]
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      fullName: string
    ): Promise<{ success: boolean; user?: AuthUser; error?: string }> => {
      const normalizedEmail = email.trim().toLowerCase();
      const cleanedPassword = password.trim();
      const cleanedName = fullName.trim();

      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        return { success: false, error: "Please enter a valid email address." };
      }
      if (cleanedPassword.length < 4) {
        return { success: false, error: "Password must be at least 4 characters." };
      }
      if (!cleanedName) {
        return { success: false, error: "Please enter your full name." };
      }

      const accounts = loadLocalAccounts();
      if (accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
        return { success: false, error: "An account with this email already exists." };
      }

      // 1. Try Backend Signup API
      try {
        const resp = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password: cleanedPassword,
            full_name: cleanedName,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const newUser: AuthUser = {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.full_name,
            role: data.user.role || "tourist",
            created_at: data.user.created_at,
          };
          saveLocalAccounts([
            ...accounts,
            { ...newUser, password: cleanedPassword },
          ]);
          persistSession(newUser, data.access_token);
          return { success: true, user: newUser };
        } else if (resp.status === 409) {
          return { success: false, error: "An account with this email already exists." };
        }
      } catch {
        // Fallback to local signup below
      }

      const newUser: AuthUser = {
        id: `user_${Date.now().toString(36)}`,
        email: normalizedEmail,
        full_name: cleanedName,
        role: "tourist",
        created_at: new Date().toISOString(),
      };
      saveLocalAccounts([
        ...accounts,
        { ...newUser, password: cleanedPassword },
      ]);
      const fallbackToken = `tw_local_token_${newUser.id}`;
      persistSession(newUser, fallbackToken);
      return { success: true, user: newUser };
    },
    [loadLocalAccounts, saveLocalAccounts]
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {}
  }, []);

  const fetchAdminTeam = useCallback(async () => {
    if (token) {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/v1/admin/team`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = (await resp.json()) as AuthUser[];
          setAdminTeam(data);
          return;
        }
      } catch {}
    }
    const accounts = loadLocalAccounts();
    const admins = accounts
      .filter((a) => a.role === "admin" || a.role === "superuser")
      .map(({ password: _, ...rest }) => rest);
    setAdminTeam(admins);
  }, [token, loadLocalAccounts]);

  const addAdminMember = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: "admin" | "superuser" = "admin"
    ): Promise<{ success: boolean; error?: string }> => {
      const normalizedEmail = email.trim().toLowerCase();
      const cleanedPassword = password.trim();
      const cleanedName = fullName.trim();

      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        return { success: false, error: "Valid email address is required." };
      }
      if (cleanedPassword.length < 4) {
        return { success: false, error: "Password must be at least 4 characters." };
      }
      if (!cleanedName) {
        return { success: false, error: "Admin full name is required." };
      }

      // 1. Try Backend Admin Team API
      if (token) {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/v1/admin/team`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email: normalizedEmail,
              password: cleanedPassword,
              full_name: cleanedName,
              role,
            }),
          });
          if (resp.ok) {
            const created = (await resp.json()) as AuthUser;
            const accounts = loadLocalAccounts();
            if (!accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
              saveLocalAccounts([...accounts, { ...created, password: cleanedPassword }]);
            }
            setAdminTeam((prev) =>
              prev.some((a) => a.email.toLowerCase() === normalizedEmail)
                ? prev
                : [...prev, created]
            );
            return { success: true };
          } else if (resp.status === 409) {
            return { success: false, error: "A user with this email already exists." };
          }
        } catch {}
      }

      // 2. Local fallback
      const accounts = loadLocalAccounts();
      if (accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
        return { success: false, error: "A user with this email already exists." };
      }
      const newAdmin: StoredLocalAccount = {
        id: `user_admin_${Date.now().toString(36)}`,
        email: normalizedEmail,
        password: cleanedPassword,
        full_name: cleanedName,
        role,
        created_at: new Date().toISOString(),
      };
      const updated = [...accounts, newAdmin];
      saveLocalAccounts(updated);
      const { password: _, ...publicAdmin } = newAdmin;
      setAdminTeam((prev) => [...prev, publicAdmin]);
      return { success: true };
    },
    [token, loadLocalAccounts, saveLocalAccounts]
  );

  const isAuthenticated = Boolean(user);
  const isAdmin = Boolean(user && (user.role === "admin" || user.role === "superuser"));

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        adminTeam,
        login,
        signup,
        logout,
        fetchAdminTeam,
        addAdminMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
