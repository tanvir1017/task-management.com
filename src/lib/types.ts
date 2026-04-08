/**
 * Task Management Types
 */

export type UserRole = "USER" | "ADMIN" | "SYSTEM_ADMIN";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type AuditActionType =
  | "CREATE_TASK"
  | "UPDATE_TASK"
  | "DELETE_TASK"
  | "UPDATE_STATUS"
  | "ASSIGN_TASK";

export interface User {
  id: number;
  email: string;
  username: string;
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  creatorId: number;
  assigneeId: number | null;
  createdAt: Date;
  updatedAt: Date;
  creator?: {
    fullName: string | null;
    email: string;
  };
  assignee?: {
    fullName: string | null;
    email: string;
  } | null;
}

export interface AuditLog {
  id: number;
  actorId: number;
  actionType: AuditActionType;
  targetEntity: number;
  payload: Record<string, unknown>;
  createdAt: Date;
  actor?: {
    id: number;
    email: string;
    username: string;
    fullName: string | null;
  };
}

// Request/Response types
export interface CreateTaskRequest {
  title: string;
  description?: string;
  assignedToId: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  assignedToId?: number;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaskQueryListResponse {
  result: Task[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    count: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface UserListResponse {
  result: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    count: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AuditLogListResponse {
  result: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    count: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
