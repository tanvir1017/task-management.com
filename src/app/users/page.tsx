"use client";

import ComponentCard from "@/components/common/ComponentCard";
import { ProtectedRoute } from "@/components/protected-route";
import UsersTable from "@/components/tables/UsersTable";
import AdminLayout from "@/layout/AdminLayout";

export default function UsersPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SYSTEM_ADMIN"]}>
      <AdminLayout>
        <div>
          <ComponentCard title="Users">
            <UsersTable />
          </ComponentCard>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
