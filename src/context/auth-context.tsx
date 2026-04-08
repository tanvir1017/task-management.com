"use client";

import {
  loginRequest,
  registerRequest,
  RegisterRequest,
} from "@/lib/api-client";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "ADMIN" | "SYSTEM_ADMIN" | "USER";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        // Normalize role in case it was stored with different casing
        parsedUser.role = normalizeRole(parsedUser.role);
        setUser(parsedUser);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await loginRequest({ email, password });
      const token = response.accessToken;
      const userFromToken = extractUserFromToken(token, email);

      if (typeof window !== "undefined") {
        console.log("[Auth Debug] User logged in:", userFromToken);
      }

      localStorage.setItem("user", JSON.stringify(userFromToken));
      localStorage.setItem("token", token);
      setUser(userFromToken);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (payload: RegisterRequest) => {
    setIsLoading(true);
    try {
      await registerRequest(payload);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
  };

  const updateUser = (nextUser: User) => {
    const normalizedUser = {
      ...nextUser,
      role: normalizeRole(nextUser.role),
    };

    localStorage.setItem("user", JSON.stringify(normalizedUser));
    setUser(normalizedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
        updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

interface JwtPayload {
  sub?: string | number;
  email?: string;
  role?: "SYSTEM_ADMIN" | "ADMIN" | "USER";
  fullName?: string;
  username?: string;
  name?: string;
}

function extractUserFromToken(token: string, fallbackEmail: string): User {
  const payload = parseJwtPayload(token);
  const email = payload?.email || fallbackEmail;
  const displayName =
    payload?.fullName ||
    payload?.name ||
    payload?.username ||
    email.split("@")[0];

  const role = normalizeRole(payload?.role);

  if (typeof window !== "undefined") {
    console.log(
      "[Auth Debug] API role:",
      payload?.role,
      "-> Normalized role:",
      role,
    );
  }

  return {
    id: String(payload?.sub || email),
    email,
    role,
    name: displayName,
  };
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const normalizedPayload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const decoded = atob(normalizedPayload);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

function normalizeRole(role?: string): UserRole {
  if (!role) return "USER";

  const upperRole = role.toUpperCase();

  if (upperRole === "ADMIN") return "ADMIN";
  if (upperRole === "SYSTEM_ADMIN") return "SYSTEM_ADMIN";
  if (upperRole === "USER") return "USER";

  return "USER";
}
