"use client";


import { useAuth, UserRole } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

function isRoleAllowed(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  const isAllowed = allowedRoles.some(
    (role) => role.toUpperCase() === userRole.toUpperCase(),
  );

  if (typeof window !== "undefined") {
    console.log(
      "[ProtectedRoute Debug] User role:",
      userRole,
      "| Allowed roles:",
      allowedRoles,
      "| Is allowed:",
      isAllowed,
    );
  }

  return isAllowed;
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (allowedRoles && isAuthenticated && user) {
      if (!isRoleAllowed(user.role, allowedRoles)) {
        router.push("/login");
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, allowedRoles, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && user && !isRoleAllowed(user.role, allowedRoles)) {
    return null;
  }

  return <>{children}</>;
}
