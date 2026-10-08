import type { ApiClient, Project } from "./api";

export interface ProjectPreviewResult {
  url: string | null;
  state: "ready" | "stopped" | "creating" | "unavailable";
  project?: Project;
}

export async function loadProjectPreview(
  id: string,
  getProject: ApiClient["getProject"],
): Promise<ProjectPreviewResult> {
  try {
    const result = await getProject(id);
    const project = result.data;
    if (!result.success || !project || project.id !== id)
      return { url: null, state: "unavailable" };
    if (project.status !== "running") {
      return {
        url: null,
        state: project.status === "creating" ? "creating" : project.status === "stopped" ? "stopped" : "unavailable",
        project,
      };
    }
    if (!project.previewUrl) return { url: null, state: "unavailable", project };
    const url = new URL(project.previewUrl);
    if (url.protocol !== "https:" || url.username || url.password)
      return { url: null, state: "unavailable", project };
    return { url: url.href, state: "ready", project };
  } catch {
    return { url: null, state: "unavailable" };
  }
}
