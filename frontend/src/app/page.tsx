"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Code2,
  FolderOpen,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectComposer } from "@/components/project-composer";
import { Badge } from "@/components/ui/badge";
import { api, type Project } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const result = await api.getProjects();
    if (result.success && result.data) setProjects(result.data);
    else
      setListError(
        result.error ||
          "Projects could not be loaded. Check that the backend is running.",
      );
    setLoading(false);
  }, []);
  useEffect(() => {
    let active = true;
    void api.getProjects().then((result) => {
      if (!active) return;
      if (result.success && result.data) setProjects(result.data);
      else
        setListError(
          result.error ||
            "Projects could not be loaded. Check that the backend is running.",
        );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold tracking-tight"
          aria-label="Likeable home"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Code2 className="size-4" />
          </span>
          Likeable<span className="text-muted-foreground font-normal">/</span>
          <span className="text-sm font-normal text-muted-foreground">
            workspace
          </span>
        </Link>
        <Badge variant="outline" className="hidden sm:inline-flex">
          React app builder
        </Badge>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
        <section className="mx-auto max-w-3xl py-16 sm:py-24">
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4" /> Your next idea starts here
          </div>
          <h1 className="max-w-2xl text-4xl font-medium leading-[1.12] tracking-[-0.055em] sm:text-6xl">
            An idea. A conversation.
            <br />
            <span className="text-muted-foreground">A working app.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Describe what you want to build. Refine it together, explore the
            code, and make it your own.
          </p>
          <div className="mt-9">
            <ProjectComposer onCreated={(projectId) => router.push(`/chat/${projectId}`)} />
          </div>
        </section>
        <section className="border-t pt-8" aria-labelledby="projects-heading">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2
                id="projects-heading"
                className="text-lg font-semibold tracking-tight"
              >
                Your projects
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick up where you left off.
              </p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </div>
          {loading ? (
            <div
              role="status"
              className="flex items-center gap-2 py-10 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" />
              Loading projects…
            </div>
          ) : listError ? (
            <div role="alert" className="rounded-xl border p-5">
              <p className="text-sm text-destructive">{listError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setLoading(true);
                  setListError(null);
                  void loadProjects();
                }}
              >
                Try again
              </Button>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
              <FolderOpen className="mb-3 size-6 text-muted-foreground" />
              <h3 className="text-sm font-medium">Room for your first idea</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe an app above to start building.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/chat/${project.id}`}
                  className="group rounded-xl border bg-card p-5 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
                      <Code2 className="size-5 text-muted-foreground" />
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                  <h3 className="truncate text-sm font-semibold">
                    {project.name}
                  </h3>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="capitalize">
                      <span
                        className={`mr-1 size-1.5 rounded-full ${project.status === "running" ? "bg-emerald-600" : project.status === "error" ? "bg-destructive" : "bg-muted-foreground"}`}
                      />
                      {project.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.updatedAt).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
