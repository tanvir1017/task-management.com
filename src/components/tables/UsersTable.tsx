"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import useSWR from "swr";

import { useAuth } from "@/context/auth-context";
import {
    deleteUserAccount,
    getAllUsers,
    updateUserProfile,
} from "@/lib/api-client";
import type { User, UserRole } from "@/lib/types";

import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../ui/table";
import Pagination from "./Pagination";

const USER_ROLES: UserRole[] = ["USER", "ADMIN", "SYSTEM_ADMIN"];

type ActiveFilter = "" | "true" | "false";

export default function UsersTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();

  const getPositiveInt = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 1) return fallback;
    return parsed;
  };

  const getValidRole = (value: string | null): "" | UserRole => {
    if (!value) return "";
    return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : "";
  };

  const getValidActive = (value: string | null): ActiveFilter => {
    if (value === "true" || value === "false") return value;
    return "";
  };

  const initialSearch = searchParams.get("search") ?? "";
  const initialRole = getValidRole(searchParams.get("role"));
  const initialIsActive = getValidActive(searchParams.get("isActive"));
  const initialPage = getPositiveInt(searchParams.get("page"), 1);
  const initialLimit = getPositiveInt(searchParams.get("limit"), 10);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState<"" | UserRole>(initialRole);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(initialIsActive);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize] = useState(initialLimit);

  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    username: "",
  });

  const {
    data: usersData,
    isLoading,
    error,
    mutate,
  } = useSWR(
    ["users", searchQuery, roleFilter, activeFilter, currentPage, pageSize],
    () =>
      getAllUsers({
        search: searchQuery || undefined,
        role: roleFilter || undefined,
        isActive: activeFilter || undefined,
        page: currentPage,
        limit: pageSize,
      }),
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (roleFilter) params.set("role", roleFilter);
    if (activeFilter) params.set("isActive", activeFilter);
    params.set("page", String(currentPage));
    params.set("limit", String(pageSize));

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchQuery, roleFilter, activeFilter, currentPage, pageSize, pathname, router]);

  const users = usersData?.result ?? [];
  const totalPages = usersData?.meta?.totalPages ?? 1;

  const formatDateTime = (value: Date | string) => {
    return new Date(value)
      .toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(" AM", " am")
      .replace(" PM", " pm");
  };

  const formatRoleLabel = (value: string) => {
    return value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const formatName = (userRow: User) => {
    return userRow.fullName || userRow.username || userRow.email;
  };

  const isCurrentUser = (userRow: User) => String(currentUser?.id) === String(userRow.id);

  const canDeleteUser = (userRow: User) => {
    if (!currentUser) return false;
    if (currentUser.role === "SYSTEM_ADMIN" && isCurrentUser(userRow)) return false;
    if (currentUser.role === "ADMIN" && userRow.role === "SYSTEM_ADMIN") return false;
    return true;
  };

  const canEditUser = (userRow: User) => {
    if (!currentUser) return false;
    return currentUser.role === "ADMIN" || currentUser.role === "SYSTEM_ADMIN";
  };

  const openDetails = (userRow: User) => {
    setSelectedUser(userRow);
    setShowDetailsModal(true);
  };

  const openEdit = (userRow: User) => {
    setSelectedUser(userRow);
    setEditForm({
      fullName: userRow.fullName || "",
      email: userRow.email,
      username: userRow.username,
    });
    setShowEditModal(true);
  };

  const openDelete = (userRow: User) => {
    if (!canDeleteUser(userRow)) {
      toast.error("You do not have permission to delete this account.");
      return;
    }

    setSelectedUser(userRow);
    setShowDeleteModal(true);
  };

  const closeModals = () => {
    setShowDetailsModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedUser(null);
  };

  const handleApplyFilters = (e: FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setRoleFilter("");
    setActiveFilter("");
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handleUpdateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      await updateUserProfile(selectedUser.id, {
        fullName: editForm.fullName || undefined,
        email: editForm.email,
        username: editForm.username,
      });
      await mutate();
      closeModals();
      toast.success("User profile updated successfully");
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "Failed to update user profile";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    try {
      await deleteUserAccount(selectedUser.id);
      await mutate();
      closeModals();
      toast.success("User deleted successfully");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Failed to delete user";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    if (role === "SYSTEM_ADMIN") return "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300";
    if (role === "ADMIN") return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
    return "bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300";
  };

  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive
      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
      : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
      <Toaster position="top-center" richColors />

      {error && (
        <div className="px-5 pt-4 text-sm text-gray-500 dark:text-gray-400">
          Failed to load users
        </div>
      )}

      <div className="px-4 pt-4">
        <form
          onSubmit={handleApplyFilters}
          className="flex flex-col gap-3 md:flex-row md:items-end"
        >
          <div className="w-full md:max-w-sm">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Search
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by email, username, or name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="w-full md:max-w-52">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setCurrentPage(1);
                setRoleFilter(getValidRole(e.target.value));
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Roles</option>
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:max-w-52">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              value={activeFilter}
              onChange={(e) => {
                setCurrentPage(1);
                setActiveFilter(getValidActive(e.target.value));
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm">
              Search
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleResetFilters}>
              Reset
            </Button>
          </div>
        </form>
      </div>

      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[1102px]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/5">
              <TableRow>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  User
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Username
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Role
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Status
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Created
                </TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
              {isLoading &&
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={`user-skeleton-${index}`}>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3 animate-pulse">
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="space-y-2">
                          <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-700" />
                          <div className="h-3 w-36 rounded bg-gray-100 dark:bg-gray-800" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-6 w-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex gap-2 animate-pulse">
                        <div className="h-9 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
                        <div className="h-9 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
                        <div className="h-9 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

              {users.map((userRow) => (
                <TableRow
                  key={userRow.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/3"
                  onClick={() => openDetails(userRow)}
                >
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
                        {(formatName(userRow)[0] || "U").toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {formatName(userRow)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {userRow.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    {userRow.username}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getRoleBadgeClass(userRow.role)}`}>
                      {formatRoleLabel(userRow.role)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(userRow.isActive)}`}>
                      {userRow.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400 whitespace-nowrap">
                    {formatDateTime(userRow.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(userRow);
                        }}
                        className="bg-brand-500 hover:bg-brand-600"
                      >
                        View
                      </Button>
                      {canEditUser(userRow) && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(userRow);
                          }}
                          className="bg-blue-500 hover:bg-blue-600"
                        >
                          Edit
                        </Button>
                      )}
                      {canDeleteUser(userRow) && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(userRow);
                          }}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && !error && users.length === 0 && (
                <TableRow>
                  <TableCell className="px-4 py-6 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    No users found.
                  </TableCell>
                  <TableCell className="px-4 py-6"> </TableCell>
                  <TableCell className="px-4 py-6"> </TableCell>
                  <TableCell className="px-4 py-6"> </TableCell>
                  <TableCell className="px-4 py-6"> </TableCell>
                  <TableCell className="px-4 py-6"> </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 p-4 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </p>
          {isLoading ? (
            <div className="h-10 w-64 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ) : (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>

      <Modal isOpen={showDetailsModal} onClose={closeModals} className="mx-4 max-w-2xl">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold">User Details</h2>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Name</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatName(selectedUser)}</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedUser.email}</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Username</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedUser.username}</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Role</p>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getRoleBadgeClass(selectedUser.role)}`}>
                  {formatRoleLabel(selectedUser.role)}
                </span>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Status</p>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(selectedUser.isActive)}`}>
                  {selectedUser.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Created</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{formatDateTime(selectedUser.createdAt)}</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Updated</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{formatDateTime(selectedUser.updatedAt)}</p>
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={closeModals}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={showEditModal} onClose={closeModals} className="mx-4 max-w-2xl">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Edit User</h2>
          {selectedUser && (
            <form onSubmit={handleUpdateUser}>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModals}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating} className="disabled:opacity-60">
                  {isUpdating ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={closeModals} className="mx-4 max-w-lg">
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Delete User</h2>
          {selectedUser && (
            <p>
              Are you sure you want to delete <strong>{formatName(selectedUser)}</strong>?
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeModals}>
              Cancel
            </Button>
            <Button type="button" onClick={handleDeleteUser} disabled={isDeleting} className="bg-red-500 hover:bg-red-600 disabled:opacity-60">
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
