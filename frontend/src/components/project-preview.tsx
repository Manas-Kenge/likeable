"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, LoaderCircle } from "lucide-react";
import { api, type Project } from "@/lib/api";
import { loadProjectPreview, type ProjectPreviewResult } from "@/lib/project-preview";
import styles from "./project-preview.module.css";

export function ProjectPreview({
  project,
  onProjectChecked,
}: {
  project: Project;
  onProjectChecked: (project: Project) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [visit, setVisit] = useState(0);
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<ProjectPreviewResult | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = preview?.url;
  const failed = !!src && failedUrl === src;
  const loaded = !!src && loadedUrl === src && !failed;

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const sizeObserver = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      // Release offscreen app frames; check the session again on re-entry.
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setVisit((current) => current + 1);
      setPreview(null);
      setLoadedUrl(null);
      setFailedUrl(null);
    }, { rootMargin: "160px" });
    sizeObserver.observe(node);
    visibilityObserver.observe(node);
    return () => {
      sizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const timer = setTimeout(() => {
      active = false;
      setPreview({ url: null, state: "unavailable" });
    }, 20000);
    void loadProjectPreview(project.id, (id) => api.getProject(id)).then((result) => {
      if (!active) return;
      clearTimeout(timer);
      setPreview(result);
      if (result.project) onProjectChecked(result.project);
    });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [visible, visit, project.id, onProjectChecked]);

  useEffect(() => {
    if (!visible || !src || loadedUrl === src || failedUrl === src) return;
    const timer = setTimeout(() => setFailedUrl(src), 20000);
    return () => clearTimeout(timer);
  }, [visible, src, loadedUrl, failedUrl]);

  const pending = visible && !failed && (!preview || (src && !loaded));
  const state = preview?.state;
  const title = pending ? "Loading preview…" : state === "stopped" ? "Preview paused" : state === "creating" ? "Preparing preview" : "Preview unavailable";
  const hint = state === "stopped" ? "Open project to resume preview" : state === "creating" ? "Open project to follow progress" : "Open project to view your app";

  return (
    <div ref={container} className={styles.frame} aria-hidden="true" inert>
      {visible && src && width > 0 && !failed && (
        <iframe
          src={src}
          title={`${project.name} preview`}
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={styles.canvas}
          style={{ transform: `scale(${width / 1280})` }}
          onLoad={() => setLoadedUrl(src)}
          onError={() => setFailedUrl(src)}
        />
      )}
      {!loaded && (
        <div className={styles.placeholder}>
          <span className="flex size-10 items-center justify-center rounded-xl border bg-card">
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Globe className="size-4" />}
          </span>
          <span className="text-sm font-medium">{title}</span>
          {!pending && <span className="text-xs">{hint}</span>}
        </div>
      )}
      {loaded && <span className={styles.caption}>Live preview</span>}
    </div>
  );
}
