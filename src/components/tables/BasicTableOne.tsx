"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";

import { useAuth } from "@/context/auth-context";
import {
  createTask,
  deleteTask,
  getAllTasks,
  getAuditLogsByTaskId,
  getUsers,
  updateTask,
  updateTaskStatus,
} from "@/lib/api-client";
import type { AuditLog, Task, TaskStatus } from "@/lib/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import useSWR from "swr";
import Badge from "../ui/badge/Badge";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import Pagination from "./Pagination";

interface BasicTableOneProps {
  hideCreateButton?: boolean;
  showCreateModal?: boolean;
  onShowCreateModal?: (show: boolean) => void;
}

export default function BasicTable({
  hideCreateButton = false,
  showCreateModal: controlledShowCreateModal,
  onShowCreateModal,
}: BasicTableOneProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const allowedStatuses: TaskStatus[] = [
    "PENDING",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ];

  const getValidStatus = (value: string | null): "" | TaskStatus => {
    if (!value) return "";
    return allowedStatuses.includes(value as TaskStatus)
      ? (value as TaskStatus)
      : "";
  };

  const getPositiveInt = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 1) return fallback;
    return parsed;
  };

  const initialSearch = searchParams.get("search") ?? "";
  const initialStatus = getValidStatus(searchParams.get("status"));
  const initialPage = getPositiveInt(searchParams.get("page"), 1);
  const initialLimit = getPositiveInt(searchParams.get("limit"), 10);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [internalShowCreateModal, setInternalShowCreateModal] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<"" | TaskStatus>(initialStatus);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize] = useState(initialLimit);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    assigneeId: "",
  });
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "PENDING" as TaskStatus,
  });
  const { user } = useAuth();
  const canManageAllTasks = user?.role === "ADMIN" || user?.role === "SYSTEM_ADMIN";
  const showCreateModal = controlledShowCreateModal ?? internalShowCreateModal;
  const setShowCreateModal = onShowCreateModal ?? setInternalShowCreateModal;

  const {
    data: taskData,
    error: tasksError,
    isLoading: tasksLoading,
    mutate: mutateTasks,
  } = useSWR(
    ["tasks", searchQuery, statusFilter, currentPage, pageSize],
    () =>
      getAllTasks({
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        page: currentPage,
        limit: pageSize,
      }),
  );

  const { data: users } = useSWR(showCreateModal ? "users" : null, getUsers);
  const {
    data: taskAuditLogs,
    isLoading: taskAuditLoading,
    error: taskAuditError,
  } = useSWR(
    showHistorySidebar && selectedTask?.id
      ? ["task-audits", selectedTask.id]
      : null,
    ([, taskId]) => getAuditLogsByTaskId(taskId as number, { page: 1, limit: 100 }),
  );

  const tasks = taskData?.result ?? [];
  const totalPages = taskData?.meta?.totalPages ?? 1;

  useEffect(() => {
    const params = new URLSearchParams();

    if (searchQuery) params.set("search", searchQuery);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(currentPage));
    params.set("limit", String(pageSize));

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchQuery, statusFilter, currentPage, pageSize, pathname, router]);

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
    });
    setShowEditModal(true);
  };

  const handleDelete = (task: Task) => {
    setSelectedTask(task);
    setShowDeleteModal(true);
  };

  const handleHistory = (task: Task) => {
    setSelectedTask(task);
    setShowHistorySidebar(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreatingTask(true);
    try {
      await createTask({
        title: createForm.title,
        description: createForm.description || undefined,
        assignedToId: parseInt(createForm.assigneeId),
      });
      await mutateTasks();
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        description: "",
        assigneeId: "",
      });
      toast.success("Task created successfully");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to create task";
      toast.error(message);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleApplyFilters = (e: FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearchQuery(searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTask) return;

    setIsDeletingTask(true);
    try {
      await deleteTask(selectedTask.id);
      await mutateTasks();
      setShowDeleteModal(false);
      setSelectedTask(null);
      toast.success("Task deleted successfully");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to delete task";
      toast.error(message);
    } finally {
      setIsDeletingTask(false);
    }
  };

  const handleUpdateTaskStatus = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedTask) return;

    setIsUpdatingTask(true);
    try {
      if (canManageAllTasks) {
        await updateTask(selectedTask.id, {
          title: editForm.title,
          description: editForm.description || undefined,
        });
      }

      if (selectedTask.status !== editForm.status) {
        await updateTaskStatus(selectedTask.id, {
          status: editForm.status as Task["status"],
        });
      }

      await mutateTasks();
      setShowEditModal(false);
      setSelectedTask(null);
      toast.success("Task updated successfully");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to update task";
      toast.error(message);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const closeModals = () => {
    setShowEditModal(false);
    setShowDeleteModal(false);
    setShowHistorySidebar(false);
    setShowDetailsModal(false);
    setShowCreateModal(false);
    setSelectedTask(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "warning";
      case "IN_PROGRESS":
        return "info";
      case "COMPLETED":
        return "success";
      case "CANCELLED":
        return "error";
      default:
        return "primary";
    }
  };

  const formatStatusLabel = (status: string) => {
    return status
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const formatReadableDateTime = (value: Date | string) => {
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

  const formatActionLabel = (value: string) => {
    return value
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  };

  const formatFieldLabel = (key: string) => {
    return key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatPayloadValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string") {
      if (value.includes("_") && value === value.toUpperCase()) {
        return formatActionLabel(value);
      }
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.length ? value.map((item) => formatPayloadValue(item)).join(", ") : "—";
    if (isPlainObject(value)) return Object.keys(value).length ? JSON.stringify(value) : "—";
    return String(value);
  };

  const getPayloadChanges = (payload: Record<string, unknown>) => {
    const before = isPlainObject(payload.before) ? payload.before : {};
    const after = isPlainObject(payload.after) ? payload.after : {};
    const hasBeforeAfter = Object.keys(before).length > 0 || Object.keys(after).length > 0;

    if (!hasBeforeAfter) {
      return Object.entries(payload).map(([field, value]) => ({
        field,
        before: "—",
        after: formatPayloadValue(value),
        changed: true,
      }));
    }

    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys.map((field) => {
      const beforeValue = formatPayloadValue(before[field]);
      const afterValue = formatPayloadValue(after[field]);
      return {
        field,
        before: beforeValue,
        after: afterValue,
        changed: beforeValue !== afterValue,
      };
    });
  };

  const getActionBadgeClass = (value: string) => {
    if (value === "DELETE_TASK") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";
    if (value === "CREATE_TASK") return "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400";
    if (value === "UPDATE_STATUS") return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400";
    return "bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
      <Toaster position="top-center" richColors />

      {!hideCreateButton && (user?.role === "ADMIN" || user?.role === "SYSTEM_ADMIN") && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            Create Task
          </Button>
        </div>
      )}

      {tasksError && (
        <div className="px-5 pt-4 text-sm text-gray-500 dark:text-gray-400">
          Failed to load tasks
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
              placeholder="Search by title or description"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div className="w-full md:max-w-[220px]">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setCurrentPage(1);
                setStatusFilter(getValidStatus(e.target.value));
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
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
            {/* Table Header */}
            <TableHeader className="border-b border-gray-100 dark:border-white/5">
              <TableRow>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Task Title
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Creator
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Assignee
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Created
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            {/* Table Body */}
            <TableBody className="divide-y divide-gray-100 dark:divide-white/5">
              {tasksLoading &&
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell className="px-4 py-3">
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="h-3 w-64 rounded bg-gray-100 dark:bg-gray-800" />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3 animate-pulse">
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="space-y-2">
                          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                          <div className="h-3 w-32 rounded bg-gray-100 dark:bg-gray-800" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3 animate-pulse">
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="space-y-2">
                          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                          <div className="h-3 w-32 rounded bg-gray-100 dark:bg-gray-800" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-6 w-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 animate-pulse">
                        <div className="h-9 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
                        <div className="h-9 w-18 rounded-lg bg-gray-200 dark:bg-gray-700" />
                        <div className="h-9 w-18 rounded-lg bg-gray-200 dark:bg-gray-700" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

              {tasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/3"
                  onClick={() => {
                    setSelectedTask(task);
                    setShowDetailsModal(true);
                  }}
                >
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white/90">{task.title}</div>
                      {task.description && (
                        <div className="max-w-[260px] truncate text-xs text-gray-500">
                          {task.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 overflow-hidden rounded-full bg-brand-500 flex items-center justify-center text-white font-semibold text-sm">
                        {(task.creator?.fullName || task.creator?.email || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                          {task.creator?.fullName || "Unknown"}
                        </span>
                        <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                          {task.creator?.email || ""}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 overflow-hidden rounded-full bg-brand-500 flex items-center justify-center text-white font-semibold text-sm">
                        {task.assignee ? (task.assignee.fullName || task.assignee.email)[0].toUpperCase() : "U"}
                      </div>
                      <div>
                        <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                          {task.assignee ? task.assignee.fullName || "Unassigned" : "Unassigned"}
                        </span>
                        <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                          {task.assignee ? task.assignee.email : ""}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    <Badge size="sm" color={getStatusColor(task.status)}>
                      {formatStatusLabel(task.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400 whitespace-nowrap">
                    {formatReadableDateTime(task.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(task);
                        }}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        {canManageAllTasks ? "Edit" : "Change Status"}
                      </Button>
                      {canManageAllTasks && (
                        <>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(task);
                            }}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHistory(task);
                            }}
                            className="bg-gray-600 hover:bg-gray-700"
                          >
                            History
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!tasksLoading && !tasksError && tasks.length === 0 && (
                <TableRow>
                  <TableCell className="px-4 py-6 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                    No tasks found.
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
          {tasksLoading ? (
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
          <h2 className="mb-4 text-lg font-semibold">Task Details</h2>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Title</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedTask.title}</p>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Description</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedTask.description || "No description provided"}
                </p>
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

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={closeModals} className="mx-4 max-w-2xl">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {canManageAllTasks ? "Edit Task" : "Update Task Status"}
          </h2>
          {selectedTask && (
            <form onSubmit={handleUpdateTaskStatus}>
              {canManageAllTasks && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      rows={3}
                    />
                  </div>
                </>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TaskStatus })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModals}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdatingTask}
                  className="disabled:opacity-60"
                >
                  {isUpdatingTask ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeModals} className="mx-4 max-w-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Delete Task</h2>
          {selectedTask && (
            <p>Are you sure you want to delete "{selectedTask.title}"?</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" onClick={closeModals}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeletingTask}
              className="disabled:opacity-60"
            >
              {isDeletingTask ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={showHistorySidebar} onClose={closeModals} className="mx-4 max-w-3xl">
        <div className="max-h-[80vh] overflow-y-auto p-6">
          <h2 className="text-lg font-semibold mb-2">Task History</h2>
          {selectedTask && (
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Audit logs for "{selectedTask.title}"
            </p>
          )}

          {taskAuditLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`history-skeleton-${index}`} className="animate-pulse rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <div className="mb-3 h-4 w-36 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mb-2 h-3 w-56 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          )}

          {taskAuditError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load task audit history.
            </p>
          )}

          {!taskAuditLoading && !taskAuditError && (taskAuditLogs?.length ?? 0) === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No history found for this task.</p>
          )}

          {!taskAuditLoading && !taskAuditError && (taskAuditLogs?.length ?? 0) > 0 && (
            <div className="space-y-3">
              {(taskAuditLogs as AuditLog[]).map((log) => (
                <div key={log.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getActionBadgeClass(log.actionType)}`}>
                      {formatActionLabel(log.actionType)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatReadableDateTime(log.createdAt)}
                    </span>
                  </div>

                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    By {log.actor?.fullName || "Unknown User"} ({log.actor?.email || "No email"})
                  </p>

                  <div className="space-y-2">
                    {getPayloadChanges(log.payload).map((change) => (
                      <div key={`${log.id}-${change.field}`} className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                        <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {formatFieldLabel(change.field)}
                        </p>
                        <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                          <div className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">
                            <span className="mr-1 font-medium">Before:</span>
                            {change.before}
                          </div>
                          <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                            {change.changed ? "→" : "="}
                          </div>
                          <div className="rounded-md bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:bg-green-500/10 dark:text-green-300">
                            <span className="mr-1 font-medium">After:</span>
                            {change.after}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={closeModals}
        className="mx-4 max-w-2xl"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Task</h2>
          <form onSubmit={handleCreate}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                rows={3}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Assignee</label>
              <select
                value={createForm.assigneeId}
                onChange={(e) => setCreateForm({ ...createForm, assigneeId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                required
              >
                <option value="">Select Assignee</option>
                {users?.filter((u) => u.id !== Number(user?.id)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeModals}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingTask} className="disabled:opacity-60">
                {isCreatingTask ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
