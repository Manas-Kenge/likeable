"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { approach, blades, CAP, clamp, format, glyphOf, layout, restPivot, scramble } from "./shutter-glyph-footer-shapes";
import styles from "./shutter-glyph-footer.module.css";

export type FooterLink = { label: string; href: string };
export interface ShutterGlyphFooterProps {
  brand?: string;
  wordmark?: string;
  shutterAt?: number;
  company?: string;
  year?: number;
  links?: FooterLink[];
  animate?: boolean;
  className?: string;
}

const LINKS: FooterLink[] = [
  { label: "Your projects", href: "#projects" },
];
const GITHUB_LINK: FooterLink = { label: "GitHub", href: "https://github.com/Manas-Kenge/likeable" };
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readReducedMotion = () => window.matchMedia(MOTION_QUERY).matches;
const serverReducedMotion = () => true;
const delay = (ms: number) => ({ "--footer-delay": `${ms}ms` }) as React.CSSProperties;

function Arrow() {
  return <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h9.2M6.4 2.2 10.2 6l-3.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>;
}

function ScrambleLink({ link, still }: { link: FooterLink; still: boolean }) {
  const text = React.useRef<HTMLSpanElement>(null);
  const raf = React.useRef(0);
  const settle = React.useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    if (text.current) text.current.textContent = link.label;
  }, [link.label]);
  React.useEffect(() => {
    if (still) settle();
    return settle;
  }, [still, settle]);

  const run = () => {
    if (still || !text.current) return;
    settle();
    const start = performance.now();
    const seed = Math.random() * 100;
    let frame = 0;
    const tick = (now: number) => {
      const progress = (now - start) / 320;
      if (progress >= 1) { settle(); return; }
      if (frame++ % 2 === 0 && text.current)
        text.current.textContent = scramble(link.label, progress, seed + frame);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <a
      href={link.href}
      className={styles.link}
      aria-label={link.label}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") run(); }}
      onPointerLeave={settle}
      onFocus={run}
      onBlur={settle}
      onClick={settle}
      {...(/^https?:/.test(link.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span ref={text} aria-hidden="true">{link.label}</span>
      <Arrow />
    </a>
  );
}

export default function ShutterGlyphFooter({
  brand = "Likeable",
  wordmark,
  shutterAt = 4,
  company = brand,
  year = new Date().getFullYear(),
  links = LINKS,
  animate = true,
  className,
}: ShutterGlyphFooterProps) {
  const word = (wordmark?.trim() || brand.trim() || "Likeable").toUpperCase();
  const { items, width } = React.useMemo(() => layout(word, shutterAt), [word, shutterAt]);
  const shutter = items.find((item) => item.shutter);
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const upId = `footer-up-${uid}`;
  const downId = `footer-down-${uid}`;
  const reduced = React.useSyncExternalStore(subscribeMotion, readReducedMotion, serverReducedMotion);
  const still = reduced || !animate;
  const root = React.useRef<HTMLElement>(null);
  const svg = React.useRef<SVGSVGElement>(null);
  const polygons = React.useRef<(SVGPolygonElement | null)[]>([]);
  const pointer = React.useRef({ x: 77, y: 77, inside: false });
  const pivot = React.useRef<[number, number]>(restPivot(0));
  const wake = React.useRef<() => void>(() => {});
  const animations = React.useRef(new Set<Animation>());
  const [turns, setTurns] = React.useState(0);
  const [seen, setSeen] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    }, { threshold: 0.1 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const running = animations.current;
    if (still) running.forEach((animation) => animation.cancel());
    return () => running.forEach((animation) => animation.cancel());
  }, [still]);

  React.useEffect(() => {
    if (!shutter) return;
    const rest = restPivot(turns);
    const paint = (x: number, y: number) => {
      blades(x, y, turns).forEach((points, index) => {
        polygons.current[index]?.setAttribute("points", points.map(format).join(" "));
      });
    };
    if (still || !visible) {
      pointer.current.inside = false;
      pivot.current = rest;
      paint(...rest);
      wake.current = () => {};
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = 0;
      if (document.hidden) return;
      const dt = (now - last) / 1000;
      last = now;
      const target = pointer.current.inside
        ? [clamp(pointer.current.x, 8, 92), clamp(pointer.current.y, 8, 92)]
        : rest;
      const next: [number, number] = [
        approach(pivot.current[0], target[0], 0.12, dt),
        approach(pivot.current[1], target[1], 0.12, dt),
      ];
      const moving = Math.abs(next[0] - target[0]) + Math.abs(next[1] - target[1]) > 0.05;
      pivot.current = moving ? next : [target[0], target[1]];
      paint(...pivot.current);
      // Stop at rest instead of running an idle animation loop.
      if (moving) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (raf || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        pointer.current.inside = false;
      } else start();
    };
    wake.current = start;
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      wake.current = () => {};
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [shutter, still, visible, turns]);

  const track = (event: React.PointerEvent<HTMLElement>) => {
    if (still || !shutter || !svg.current || event.pointerType === "touch") return;
    const box = svg.current.getBoundingClientRect();
    const scale = box.width / width || 1;
    pointer.current = {
      inside: event.type !== "pointerleave",
      x: (event.clientX - box.left) / scale - shutter.x,
      y: (event.clientY - box.top) / scale,
    };
    wake.current();
  };

  const activate = (node: SVGGElement, isShutter: boolean) => {
    if (still) return;
    if (isShutter) { setTurns((current) => (current + 1) % 4); return; }
    node.getAnimations().forEach((animation) => animation.cancel());
    const animation = node.animate([
      { transform: "scaleY(1)" },
      { transform: "scaleY(-1)", offset: 0.45 },
      { transform: "scaleY(1)" },
    ], { duration: 550, easing: "cubic-bezier(.2,.8,.2,1)" });
    animations.current.add(animation);
    void animation.finished.then(
      () => animations.current.delete(animation),
      () => animations.current.delete(animation),
    );
  };

  return (
    <footer
      ref={root}
      className={cn(styles.footer, className)}
      data-motion={!still}
      data-seen={seen}
      onPointerMove={track}
      onPointerEnter={track}
      onPointerLeave={track}
    >
      <div className={styles.top}>
        <p className={cn(styles.lede, styles.fade)} style={delay(0)}>
          Start with an idea.<br />Take the code with you.
        </p>
        <nav aria-label="Footer workspace" className={styles.fade} style={delay(60)}>
          <ul className={styles.list}>
            {links.map((link) => <li key={link.href}><ScrambleLink link={link} still={still} /></li>)}
          </ul>
        </nav>
        <p className={cn(styles.copy, styles.fade)} style={delay(120)}>
          © {year}<br />{company}
        </p>
        <div className={styles.fade} style={delay(180)}>
          <ScrambleLink link={GITHUB_LINK} still={still} />
        </div>
      </div>
      <div className={styles.wordmark}>
        <svg
          ref={svg}
          className={styles.svg}
          viewBox={`0 0 ${width} ${CAP}`}
          style={{ aspectRatio: `${width} / ${CAP}` }}
          role={still ? "img" : "group"}
          aria-label={still ? word : `${word} interactive wordmark`}
        >
          <defs>
            <clipPath id={upId} clipPathUnits="userSpaceOnUse"><rect x="-40" y="-200" width="400" height="252.6" /></clipPath>
            <clipPath id={downId} clipPathUnits="userSpaceOnUse"><rect x="-40" y="51.4" width="400" height="250" /></clipPath>
          </defs>
          {items.map((item, index) => {
            if (!item.ch.trim()) return null;
            const glyph = glyphOf(item.ch);
            const paths = glyph.d.map((path, key) => <path key={key} d={path} fillRule="evenodd" />);
            const rest = restPivot(turns);
            return (
              <g key={index} transform={`translate(${item.x} 0)`}>
                <g className={styles.rise} style={delay(100 + index * 35)}>
                  <g
                    className={cn(styles.glyph, styles.flip, item.shutter && styles.shutter)}
                    role={still ? undefined : "button"}
                    tabIndex={still ? undefined : 0}
                    aria-label={still ? undefined : item.shutter ? `Rotate the ${brand} shutter` : `Flip letter ${item.ch}`}
                    onClick={(event) => activate(event.currentTarget, item.shutter)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        activate(event.currentTarget, item.shutter);
                      }
                    }}
                  >
                    <rect width={item.w} height={CAP} fill="transparent" />
                    {item.shutter ? blades(...rest, turns).map((points, blade) => (
                      <polygon key={blade} points={points.map(format).join(" ")} ref={(node) => { polygons.current[blade] = node; }} />
                    )) : (
                      <>
                        <g clipPath={`url(#${upId})`}><g className={cn(styles.half, styles.up)}>{paths}</g></g>
                        <g clipPath={`url(#${downId})`}><g className={cn(styles.half, styles.down)}>{paths}</g></g>
                      </>
                    )}
                    <rect className={styles.focusBox} x="1" y="1" width={item.w - 2} height={CAP - 2} />
                  </g>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </footer>
  );
}
