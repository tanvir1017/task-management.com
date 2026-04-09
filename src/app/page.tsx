"use client";

import ComponentCard from "@/components/common/ComponentCard";
import { ProtectedRoute } from "@/components/protected-route";
import BasicTable from "@/components/tables/BasicTableOne";
import Button from "@/components/ui/button/Button";
import { useAuth } from "@/context/auth-context";
import AdminLayout from "@/layout/AdminLayout";
import { useState } from "react";

export default function Dashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="">
          <ComponentCard
            title="All Tasks"
            headerAction={
              (user?.role === "ADMIN" || user?.role === "SYSTEM_ADMIN") && (
                <Button size="sm" onClick={() => setShowCreateModal(true)}>
                  Create Task
                </Button>
              )
            }
          >
            <BasicTable
              hideCreateButton
              showCreateModal={showCreateModal}
              onShowCreateModal={setShowCreateModal}
            />
          </ComponentCard>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}