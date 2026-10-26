"use server";

import { revalidatePath } from "next/cache";
import { serverApiFetch } from "@/lib/api";

export type ProjectMemberRole = "owner" | "editor" | "viewer";

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  current_user_role: ProjectMemberRole;
  member_count: number;
  archived_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: ProjectResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface MemberResponse {
  id: string;
  user_id: string;
  name: string;
  email: string;
  image_url: string | null;
  role: ProjectMemberRole;
  joined_at: string;
}

export interface ProjectCreateInput {
  name: string;
  description?: string | null;
}

export interface ProjectUpdateInput {
  name?: string | null;
  description?: string | null;
  version: number;
}

export async function getProjects(
  includeArchived = false,
  limit = 50,
  offset = 0
): Promise<ProjectListResponse> {
  const params = new URLSearchParams({
    include_archived: String(includeArchived),
    limit: String(limit),
    offset: String(offset),
  });
  return serverApiFetch<ProjectListResponse>(`/projects?${params.toString()}`);
}

export async function getProject(id: string): Promise<ProjectResponse> {
  return serverApiFetch<ProjectResponse>(`/projects/${id}`);
}

export async function createProject(data: ProjectCreateInput): Promise<ProjectResponse> {
  const res = await serverApiFetch<ProjectResponse>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
  revalidatePath("/dashboard");
  return res;
}

export async function updateProject(
  id: string,
  data: ProjectUpdateInput
): Promise<ProjectResponse> {
  const res = await serverApiFetch<ProjectResponse>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  revalidatePath("/dashboard");
  return res;
}

export async function archiveProject(
  id: string,
  version: number,
  archive = true
): Promise<ProjectResponse> {
  const res = await serverApiFetch<ProjectResponse>(`/projects/${id}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived: archive, version }),
  });
  revalidatePath("/dashboard");
  return res;
}

export async function deleteProject(id: string): Promise<void> {
  await serverApiFetch<void>(`/projects/${id}`, {
    method: "DELETE",
  });
  revalidatePath("/dashboard");
}

export async function getProjectMembers(
  projectId: string,
  limit = 50,
  offset = 0
): Promise<MemberResponse[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return serverApiFetch<MemberResponse[]>(`/projects/${projectId}/members?${params.toString()}`);
}
