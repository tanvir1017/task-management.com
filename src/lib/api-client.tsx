/**
 * API Client
 * Handles all HTTP requests with error handling and auth token management
 */

import type {
    AuditLog,
    AuditLogListResponse,
    CreateTaskRequest,
    Task,
    TaskListResponse,
    TaskQueryListResponse,
    UpdateTaskRequest,
    UpdateTaskStatusRequest,
    UserListResponse,
} from "./types";

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode?: number;
  message?: string;
  data: T | null;
  error?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginPayload {
  accessToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName?: string;
  username?: string;
}

export interface RegisterPayload {
  message: string;
  redirectTo?: string;
}

export interface CurrentUserProfile {
  id: number;
  email: string;
  username: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type TaskQueryOptions = {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  assigneeId?: number;
  creatorId?: number;
};

type UserQueryOptions = {
  search?: string;
  role?: string;
  isActive?: string;
  page?: number;
  limit?: number;
};

type AuditQueryOptions = {
  search?: string;
  actionType?: string;
  actorId?: number;
  targetEntity?: number;
  page?: number;
  limit?: number;
};

class ApiClient {
  private baseUrl: string;
  private timeout: number = 10000;

  constructor(
    baseUrl: string = process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:5000/api/v1",
  ) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get authorization token from localStorage
   */
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }

  /**
   * Get request headers with auth token
   */
  private getHeaders(
    contentType: string = "application/json",
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Fetch wrapper with timeout and error handling
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Make GET request
   */
  async get<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await this.fetchWithTimeout(url, {
        ...options,
        method: "GET",
        headers: this.getHeaders(),
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  /**
   * Make POST request
   */
  async post<T>(
    endpoint: string,
    body?: object,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await this.fetchWithTimeout(url, {
        ...options,
        method: "POST",
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  /**
   * Make PATCH request
   */
  async patch<T>(
    endpoint: string,
    body?: object,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await this.fetchWithTimeout(url, {
        ...options,
        method: "PATCH",
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  /**
   * Make DELETE request
   */
  async delete<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await this.fetchWithTimeout(url, {
        ...options,
        method: "DELETE",
        headers: this.getHeaders(),
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let data: unknown;

    try {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        message: this.getEnvelopeMessage(data),
        data: null,
        error: this.getErrorMessage(data, response.status),
      };
    }

    const envelope = this.parseEnvelope<T>(data, response.status);

    return {
      success: envelope.success,
      statusCode: envelope.statusCode,
      message: envelope.message,
      data: envelope.data,
    };
  }

  /**
   * Handle errors
   */
  private handleError<T>(error: unknown): ApiResponse<T> {
    console.error("API Error:", error);

    if (
      error instanceof TypeError &&
      error.message.includes("Failed to fetch")
    ) {
      return {
        success: false,
        data: null,
        error: "Network error. Please check your connection.",
      };
    }

    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        data: null,
        error: "Request timeout. Please try again.",
      };
    }

    return {
      success: false,
      data: null,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }

  private parseEnvelope<T>(
    data: unknown,
    fallbackStatusCode: number,
  ): ApiEnvelope<T> {
    if (
      typeof data === "object" &&
      data !== null &&
      "success" in data &&
      "statusCode" in data &&
      "message" in data &&
      "data" in data
    ) {
      const parsed = data as ApiEnvelope<T>;
      return {
        success: parsed.success,
        statusCode: parsed.statusCode,
        message: parsed.message,
        data: parsed.data,
      };
    }

    return {
      success: true,
      statusCode: fallbackStatusCode,
      message: "Success",
      data: data as T,
    };
  }

  private getEnvelopeMessage(data: unknown): string | undefined {
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as Record<string, unknown>).message === "string"
    ) {
      return (data as Record<string, unknown>).message as string;
    }
    return undefined;
  }

  /**
   * Extract error message from response
   */
  private getErrorMessage(data: unknown, status: number): string {
    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as Record<string, unknown>).error === "string"
    ) {
      return (data as Record<string, unknown>).error as string;
    }

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as Record<string, unknown>).message === "string"
    ) {
      return (data as Record<string, unknown>).message as string;
    }

    const statusMessages: Record<number, string> = {
      400: "Bad request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not found",
      500: "Server error",
    };

    return statusMessages[status] || "An error occurred";
  }
}

export const apiClient = new ApiClient();

export async function loginRequest(body: LoginRequest): Promise<LoginPayload> {
  const response = await apiClient.post<LoginPayload>("/auth/login", body);
  if (!response.success || !response.data) {
    throw new Error(response.error || response.message || "Login failed");
  }
  return response.data;
}

export async function registerRequest(
  body: RegisterRequest,
): Promise<RegisterPayload> {
  const response = await apiClient.post<RegisterPayload>(
    "/auth/register",
    body,
  );
  if (!response.success || !response.data) {
    throw new Error(response.error || response.message || "Sign up failed");
  }
  return response.data;
}

/**
 * Task API Methods
 */

export async function getAllTasks(
  query: TaskQueryOptions = {},
): Promise<TaskQueryListResponse> {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.assigneeId) params.set("assigneeId", String(query.assigneeId));
  if (query.creatorId) params.set("creatorId", String(query.creatorId));

  const endpoint = `/tasks${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await apiClient.get<TaskQueryListResponse>(endpoint);
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to fetch tasks",
    );
  }
  return response.data;
}

export async function getMyTasks(): Promise<Task[]> {
  const response = await apiClient.get<TaskListResponse>("/tasks/my");
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to fetch your tasks",
    );
  }
  return response.data.tasks;
}

export async function getMyTasksWithFilters(
  search?: string,
  status?: string,
): Promise<Task[]> {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (status) params.append("status", status);

  const endpoint = `/tasks/my-task${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await apiClient.get<TaskListResponse>(endpoint);
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to fetch filtered tasks",
    );
  }
  return response.data.tasks;
}

export async function createTask(body: CreateTaskRequest): Promise<Task> {
  const response = await apiClient.post<Task>("/tasks", body);
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to create task",
    );
  }
  return response.data;
}

export async function updateTask(
  id: number,
  body: UpdateTaskRequest,
): Promise<Task> {
  const response = await apiClient.patch<Task>(`/tasks/${id}`, body);
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to update task",
    );
  }
  return response.data;
}

export async function updateTaskStatus(
  id: number,
  body: UpdateTaskStatusRequest,
): Promise<Task> {
  const response = await apiClient.patch<Task>(`/tasks/${id}/status`, body);
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to update task status",
    );
  }
  return response.data;
}

export async function deleteTask(id: number): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/tasks/${id}`);
  if (!response.success) {
    throw new Error(
      response.error || response.message || "Failed to delete task",
    );
  }

  return (
    response.data ?? {
      message: response.message || "Task deleted successfully",
    }
  );
}

/**
 * User API Methods
 */

export async function getAllUsers(
  query: UserQueryOptions = {},
): Promise<UserListResponse> {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.role) params.set("role", query.role);
  if (query.isActive) params.set("isActive", query.isActive);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));

  const endpoint = `/auth/users${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await apiClient.get<UserListResponse>(endpoint);
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to fetch users",
    );
  }
  return response.data;
}

export async function getCurrentUser(): Promise<CurrentUserProfile> {
  const response = await apiClient.get<CurrentUserProfile>("/auth/me");
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to fetch current user",
    );
  }
  return response.data;
}

export async function updateCurrentUser(body: {
  email?: string;
  username?: string;
  fullName?: string;
}): Promise<CurrentUserProfile> {
  const response = await apiClient.patch<CurrentUserProfile>("/auth/me", body);
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to update profile",
    );
  }
  return response.data;
}

/**
 * Audit Log API Methods
 */

export async function getAuditLogs(
  query: AuditQueryOptions = {},
): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.actionType) params.set("actionType", query.actionType);
  if (query.actorId) params.set("actorId", String(query.actorId));
  if (query.targetEntity)
    params.set("targetEntity", String(query.targetEntity));
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));

  const endpoint = `/audit${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await apiClient.get<AuditLogListResponse>(endpoint);
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to fetch audit logs",
    );
  }
  return response.data;
}

export async function getAuditLogsByTaskId(
  taskId: number,
  query: AuditQueryOptions = {},
): Promise<AuditLog[]> {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.actionType) params.set("actionType", query.actionType);
  if (query.actorId) params.set("actorId", String(query.actorId));
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));

  const endpoint = `/audit/tasks/${taskId}${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await apiClient.get<AuditLogListResponse>(endpoint);
  if (!response.success || !response.data) {
    throw new Error(
      response.error || response.message || "Failed to fetch task audit logs",
    );
  }
  return response.data.result;
}

export async function deleteAuditLog(id: number): Promise<void> {
  const response = await apiClient.delete<void>(`/audit/${id}`);
  if (!response.success) {
    throw new Error(
      response.error || response.message || "Failed to delete audit log",
    );
  }
}

export async function deleteAuditLogsByTaskId(taskId: number): Promise<void> {
  const response = await apiClient.delete<void>(`/audit/tasks/${taskId}`);
  if (!response.success) {
    throw new Error(
      response.error || response.message || "Failed to delete task audit logs",
    );
  }
}
