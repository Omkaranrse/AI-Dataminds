import { describe, expect, it, vi, beforeEach } from "vitest";
import * as apiModule from "@/lib/api";
import * as cacheModule from "next/cache";
import {
  getProjects,
  createProject,
  updateProject,
  archiveProject,
  deleteProject,
  getProjectMembers,
} from "./projects";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  serverApiFetch: vi.fn(),
}));

describe("projects lib & server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches projects with default query parameters", async () => {
    const mockResponse = { items: [], total: 0, limit: 50, offset: 0 };
    vi.mocked(apiModule.serverApiFetch).mockResolvedValueOnce(mockResponse);

    const result = await getProjects();
    expect(apiModule.serverApiFetch).toHaveBeenCalledWith(
      "/projects?include_archived=false&limit=50&offset=0"
    );
    expect(result).toEqual(mockResponse);
  });

  it("fetches projects with custom pagination and archived flag", async () => {
    const mockResponse = { items: [], total: 0, limit: 10, offset: 20 };
    vi.mocked(apiModule.serverApiFetch).mockResolvedValueOnce(mockResponse);

    const result = await getProjects(true, 10, 20);
    expect(apiModule.serverApiFetch).toHaveBeenCalledWith(
      "/projects?include_archived=true&limit=10&offset=20"
    );
    expect(result).toEqual(mockResponse);
  });

  it("creates a project and revalidates dashboard", async () => {
    const mockProject = {
      id: "p1",
      name: "Test Project",
      description: "Sample",
      owner_id: "u1",
      current_user_role: "owner" as const,
      member_count: 1,
      archived_at: null,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.mocked(apiModule.serverApiFetch).mockResolvedValueOnce(mockProject);

    const res = await createProject({ name: "Test Project", description: "Sample" });
    expect(apiModule.serverApiFetch).toHaveBeenCalledWith("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Test Project", description: "Sample" }),
    });
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(res).toEqual(mockProject);
  });

  it("updates a project and revalidates dashboard", async () => {
    const mockProject = {
      id: "p1",
      name: "Updated Name",
      description: null,
      owner_id: "u1",
      current_user_role: "owner" as const,
      member_count: 1,
      archived_at: null,
      version: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.mocked(apiModule.serverApiFetch).mockResolvedValueOnce(mockProject);

    const res = await updateProject("p1", { name: "Updated Name", version: 1 });
    expect(apiModule.serverApiFetch).toHaveBeenCalledWith("/projects/p1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Name", version: 1 }),
    });
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(res).toEqual(mockProject);
  });

  it("archives/unarchives a project and revalidates dashboard", async () => {
    const mockProject = {
      id: "p1",
      name: "Archived Project",
      description: null,
      owner_id: "u1",
      current_user_role: "owner" as const,
      member_count: 1,
      archived_at: new Date().toISOString(),
      version: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.mocked(apiModule.serverApiFetch).mockResolvedValueOnce(mockProject);

    const res = await archiveProject("p1", 1, true);
    expect(apiModule.serverApiFetch).toHaveBeenCalledWith("/projects/p1/archive", {
      method: "POST",
      body: JSON.stringify({ archived: true, version: 1 }),
    });
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(res).toEqual(mockProject);
  });

  it("deletes a project and revalidates dashboard", async () => {
    vi.mocked(apiModule.serverApiFetch).mockResolvedValueOnce(undefined);

    await deleteProject("p1");
    expect(apiModule.serverApiFetch).toHaveBeenCalledWith("/projects/p1", {
      method: "DELETE",
    });
    expect(cacheModule.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("fetches project members with query pagination", async () => {
    const mockMembers = [
      {
        id: "m1",
        user_id: "u1",
        name: "Test User",
        email: "test@example.com",
        image_url: null,
        role: "owner" as const,
        joined_at: new Date().toISOString(),
      },
    ];
    vi.mocked(apiModule.serverApiFetch).mockResolvedValueOnce(mockMembers);

    const res = await getProjectMembers("p1", 25, 5);
    expect(apiModule.serverApiFetch).toHaveBeenCalledWith(
      "/projects/p1/members?limit=25&offset=5"
    );
    expect(res).toEqual(mockMembers);
  });
});
