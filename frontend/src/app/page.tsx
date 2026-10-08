"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectComposer } from "@/components/project-composer";
import { ProjectPreview } from "@/components/project-preview";
import { api, type Project } from "@/lib/api";
import styles from "./page.module.css";

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const updateProject = useCallback((updated: Project) => {
    setProjects((current) => current.map((project) => project.id === updated.id ? updated : project));
  }, []);

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
    <div id="top" className={`${styles.page} min-h-dvh bg-background text-foreground`}>
      <div className="min-w-0 flex-1">
        <header className={styles.header}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="Likeable home"
          >
            <Image src="/likeable.svg" width={16} height={16} className={styles.brandLogo} alt="" aria-hidden="true" />
            <span>Likeable</span>
          </Link>
        </header>
        <main className={styles.main}>
          <section className={styles.hero} aria-labelledby="hero-heading">
            <div className={styles.heroCopy}>
              <h1 id="hero-heading" className={styles.headline}>
                <span>From idea to app.</span>
                <span>All in one conversation.</span>
              </h1>
              <p className={styles.description}>
                <strong className={styles.highlight}>Build with a conversation.</strong>{" "}
                Describe your idea, preview your app, and keep refining until it
                feels right. The code is yours to take.
              </p>
            </div>
            <div id="build" className={styles.buildArea}>
              <div className={styles.glow} aria-hidden="true" />
              <div className={styles.buildContent}>
                <div className="flex justify-end">
                  <div className={styles.tryNote} aria-hidden="true">
                    <svg viewBox="0 0 46 35" fill="none">
                      <path d="M40 4c-18-7-30 3-18 10 12 8 2 14-17 13m0 0 8-7m-8 7 9 4" />
                    </svg>
                    <span>Go on, try an idea.</span>
                  </div>
                </div>
                <ProjectComposer onCreated={(projectId) => router.push(`/chat/${projectId}`)} />
              </div>
            </div>
          </section>
          <section
            id="projects"
            className="scroll-mt-6 border-t pb-12 pt-7"
            aria-labelledby="projects-heading"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2
                  id="projects-heading"
                  className="text-base font-semibold tracking-tight"
                >
                  Your projects
                </h2>
                {!loading && !listError && (
                  <span className="flex size-5 items-center justify-center rounded-md border bg-background text-[10px] tabular-nums text-muted-foreground">
                    {projects.length}
                  </span>
                )}
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">
                Pick up where you left off
              </span>
            </div>
            {loading ? (
              <div
                role="status"
                className="flex items-center gap-2 rounded-xl border bg-background p-7 text-sm text-muted-foreground"
              >
                <LoaderCircle className="size-4 animate-spin" />
                Loading projects…
              </div>
            ) : listError ? (
              <div role="alert" className="rounded-xl border bg-background p-5">
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
              <div className="flex flex-col items-center rounded-xl border border-dashed bg-background px-6 py-10 text-center">
                <span className="mb-3 flex size-10 items-center justify-center rounded-xl border bg-sidebar">
                  <FolderOpen className="size-4 text-muted-foreground" />
                </span>
                <h3 className="text-sm font-medium">
                  Your first project starts here
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Describe an app above to start building.
                </p>
              </div>
            ) : (
              <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {projects.map((project) => (
                  <article
                    key={project.id}
                    className="group relative min-w-0 rounded-xl outline-offset-4 focus-within:outline-2 focus-within:outline-ring"
                  >
                    <ProjectPreview project={project} onProjectChecked={updateProject} />
                    <div className="mt-3 flex items-center gap-2.5">
                      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
                        {Array.from(project.name.trim())[0]?.toLocaleUpperCase() || "L"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/chat/${project.id}`}
                          className="block outline-none after:absolute after:inset-0"
                        >
                          <h3
                            title={project.name}
                            className="truncate text-sm font-medium transition-colors group-hover:text-primary"
                          >
                            {project.name}
                          </h3>
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Edited {new Date(project.updatedAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
