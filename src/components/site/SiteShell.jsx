// src/components/site/SiteShell.jsx
// Frame shared by every page except Home: the 3D world behind, the navbar,
// the page, the "start a project" band and the footer.
//
// Page changes: clicking a link to another page first plays the exit (the
// text blurs out, the space dims and the warp pulls the stars into the logo),
// then the next page loads and its text resolves in while the logo travels
// to its new place (see template.js and worldStore.js).
"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import SiteNav from "@/components/layout/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { world } from "@/components/world/worldStore";
import { markSeen } from "@/lib/introState";
import styles from "@/components/site/site.module.css";

// WebGL is browser-only; the page text renders first and the world fades in
const WorldCanvas = dynamic(() => import("@/components/world/WorldCanvas"), {
    ssr: false,
    loading: () => null,
});

const EXIT_MS = 480;          // length of the exit before the next page is shown
const EXIT_MS_REDUCED = 300;  // reduced motion: a plain fade, a little shorter

export default function SiteShell({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [leaving, setLeaving] = useState(false);
    const pending = useRef(null);

    // The global stylesheet locks scrolling for Home's intro; these pages scroll
    useEffect(() => {
        const html = document.documentElement;
        html.classList.add("scroll-enabled");
        markSeen();   // going to Home from here skips its loading intro
        return () => {
            html.classList.remove("scroll-enabled");
            delete html.dataset.side;
        };
    }, []);

    // The new page has arrived: lift the exit
    useEffect(() => {
        setLeaving(false);
        clearTimeout(pending.current);
    }, [pathname]);

    // Intercept clicks on links to other pages of this site
    useEffect(() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const onClick = (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = e.target.closest?.("a[href]");
            if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
            const href = a.getAttribute("href");
            if (!href || !href.startsWith("/") || href.startsWith("//")) return;

            const url = new URL(href, window.location.href);
            const here = window.location;
            // Same page (or only a #section on it): let the browser handle it
            if (url.pathname === here.pathname && url.search === here.search) return;

            const fromPath = here.pathname;
            e.preventDefault();
            setLeaving(true);
            // A stronger warp while leaving (reduced motion: no warp, just the fade)
            if (!reduced) world.pulse = Math.max(world.pulse, 1.1);
            // Start loading the next page while the exit plays
            router.prefetch(url.pathname);
            clearTimeout(pending.current);
            pending.current = setTimeout(() => {
                router.push(url.pathname + url.search + url.hash);
                // Safety net. The exit lifts when the new page arrives (pathname
                // effect above); if only ?service= changed the path stays the
                // same, so lift it shortly. A slow page (e.g. the dev server
                // compiling it) keeps the dim instead of flashing the old page.
                const samePath = url.pathname === fromPath;
                pending.current = setTimeout(() => setLeaving(false), samePath ? 400 : 8000);
            }, reduced ? EXIT_MS_REDUCED : EXIT_MS);
        };

        // Capture phase: runs before Next's <Link> handler, which then sees
        // the prevented default and leaves the navigation to us
        document.addEventListener("click", onClick, true);
        return () => {
            document.removeEventListener("click", onClick, true);
            clearTimeout(pending.current);
        };
    }, [router]);

    return (
        <div className={styles.shell} data-site-shell="">
            <div className={styles.worldLayer} aria-hidden="true">
                <WorldCanvas />
            </div>
            <div className={styles.scrim} aria-hidden="true" />
            <div className={`${styles.veil} ${leaving ? styles.veilOn : ""}`} aria-hidden="true" />
            <SiteNav variant="inner" />
            <div className={`${styles.content} ${leaving ? styles.leaving : ""}`} aria-busy={leaving || undefined}>
                {children}
                <SiteFooter />
            </div>
        </div>
    );
}
