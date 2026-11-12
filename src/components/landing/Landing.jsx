// src/components/landing/Landing.jsx
// The landing page: a short loader, then one glass sculpture in a dark
// studio (LandingScene) with the page's sections around it. Scrolling moves
// the sculpture between poses, one per section (landingStore POSES).
"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import { GeistSans } from "geist/font/sans";
import "@fontsource-variable/outfit";
import SiteFooter from "@/components/site/SiteFooter";
import ScrambleText from "@/components/layout/ScrambleText";
import { SITE } from "@/content/site";
import { SERVICES } from "@/content/services";
import { PROJECTS } from "@/content/work";
import { landing } from "@/components/landing/landingStore";
import styles from "@/components/landing/landing.module.css";

// WebGL is browser-only; the page's text renders first
const LandingScene = dynamic(() => import("@/components/landing/LandingScene"), { ssr: false, loading: () => null });

const LINKS = [
    { label: "Services", href: "/services" },
    { label: "Work", href: "/work" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
];

const STATEMENT =
    "Good work has presence. It loads fast, reads clearly, works properly and stays with the people who use it. " +
    "That's what we build, from the first sketch to the growth after launch.";

const STEPS = [
    { title: "Listen", text: "We learn your business, your customers and what a good result looks like." },
    { title: "Design", text: "We shape the experience and the look, and test them with real people." },
    { title: "Build", text: "We develop it properly: fast, accessible and easy for your team to run." },
    { title: "Grow", text: "After launch we measure, improve and keep it moving." },
];

// The dots on the right: one per section
const DOTS = [
    { stage: "hero", label: "Top" },
    { stage: "statement", label: "What we believe" },
    { stage: "services", label: "What we do" },
    { stage: "work", label: "Selected work" },
    { stage: "process", label: "How we work" },
    { stage: "cta", label: "Start a project" },
];

function Arrow({ down = false }) {
    return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style={down ? { transform: "rotate(90deg)" } : undefined}>
            <path d="M2 8h11M9 3.5 13.5 8 9 12.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

const MIN_LOADER_MS = 1400;    // long enough for the mark to draw itself
const MAX_LOADER_MS = 6000;    // never hold the page longer than this
let loaderSeen = false;        // coming back to Home in the same visit skips it

// The visitor's reduced-motion setting, kept up to date
const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb) => {
    const mq = window.matchMedia(REDUCE);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
};
const getReduced = () => window.matchMedia(REDUCE).matches;

/* The A mark's outline, for the loader (from public/logo.svg) */
function MarkOutline() {
    return (
        <svg className={styles.loaderMark} viewBox="50 104 110 89" aria-hidden="true">
            <path
                className={styles.loaderStroke}
                pathLength="1"
                d="M 51.657799,191.13823 105,105.63571 158.3422,191.26739 127.31202,191.36429 105.11633,154.10608 82.740875,191.16258 Z"
            />
            <path
                className={styles.loaderCore}
                pathLength="1"
                d="M 71.324825,181.48174 105,127.39882 138.95351,181.50457 131.78423,179.76933 105.12916,137.47313 78.494106,179.70084 Z"
            />
        </svg>
    );
}

export default function Landing() {
    const [phase, setPhase] = useState(loaderSeen ? "ready" : "loading");   // loading -> leaving -> ready
    const [menuOpen, setMenuOpen] = useState(false);
    const [navHidden, setNavHidden] = useState(false);
    const [activeDot, setActiveDot] = useState(0);
    const reduced = useSyncExternalStore(subscribeReduced, getReduced, () => false);
    const root = useRef(null);
    const statementRef = useRef(null);
    const wordRefs = useRef([]);
    const lenisRef = useRef(null);
    const scrambleRefs = useRef([]);        // the nav links' decoder (scramble) hover effect

    // Page scrolls (the global stylesheet locks scrolling until this class)
    useEffect(() => {
        const html = document.documentElement;
        html.classList.add("scroll-enabled");
        if (getReduced()) lenisRef.current?.lenis?.destroy();   // plain browser scrolling
        window.scrollTo(0, 0);
        return () => { html.classList.remove("scroll-enabled"); landing.hoverTint = null; };
    }, []);

    // Loader: leaves once the 3D scene has drawn and the mark has drawn itself
    useEffect(() => {
        if (phase !== "loading") {
            if (landing.revealAt == null) landing.revealAt = performance.now();
            return undefined;
        }
        const started = performance.now();
        let done = false;
        const leave = () => {
            if (done) return;
            done = true;
            const wait = Math.max(0, MIN_LOADER_MS - (performance.now() - started));
            setTimeout(() => {
                loaderSeen = true;
                landing.revealAt = performance.now() + 250;
                setPhase("leaving");
                setTimeout(() => setPhase("ready"), 1100);
            }, wait);
        };
        if (landing.sceneReady) leave();
        window.addEventListener("landing-scene-ready", leave);
        const cap = setTimeout(leave, MAX_LOADER_MS);
        return () => { window.removeEventListener("landing-scene-ready", leave); clearTimeout(cap); };
    }, [phase]);

    // Where each section's middle is: the scene blends poses between them
    const measure = useCallback(() => {
        const sections = root.current?.querySelectorAll("[data-stage]") ?? [];
        landing.anchors = Array.from(sections).map((el) => {
            const r = el.getBoundingClientRect();
            return { name: el.dataset.stage, center: r.top + window.scrollY + r.height / 2 };
        });
    }, []);
    useEffect(() => {
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(document.body);
        window.addEventListener("resize", measure);
        document.fonts?.ready.then(measure);
        return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
    }, [measure]);

    // On scroll: the statement lights up word by word; the navbar hides going
    // down and comes back going up
    useEffect(() => {
        let lastY = window.scrollY;
        let frame = 0;
        const update = () => {
            frame = 0;
            const y = window.scrollY;
            if (Math.abs(y - lastY) > 6) {
                setNavHidden(y > lastY && y > 160);
                lastY = y;
            }
            // which section is in the middle of the screen
            const mid = y + window.innerHeight / 2;
            let idx = 0;
            landing.anchors.forEach((a) => {
                const d = DOTS.findIndex((x) => x.stage === a.name);
                if (d >= 0 && mid >= a.center - window.innerHeight / 2) idx = d;
            });
            setActiveDot(idx);
            const el = statementRef.current;
            const words = wordRefs.current;
            if (el && words.length) {
                const r = el.getBoundingClientRect();
                const vh = window.innerHeight;
                const p = reduced ? 1 : Math.min(Math.max((vh * 0.78 - r.top) / (r.height * 0.85), 0), 1);
                const lit = p * words.length;
                words.forEach((w, i) => {
                    if (w) w.style.opacity = String(0.16 + 0.84 * Math.min(Math.max(lit - i, 0), 1));
                });
            }
        };
        const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); };
    }, [reduced]);

    // Close the phone menu with Escape
    useEffect(() => {
        if (!menuOpen) return undefined;
        const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    const goTo = (stage) => {
        const el = root.current?.querySelector(`[data-stage="${stage}"]`);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const lenis = lenisRef.current?.lenis;
        if (lenis && !reduced) lenis.scrollTo(top, { duration: 1.4 }); else window.scrollTo({ top });
    };

    const work = PROJECTS[0];
    const words = STATEMENT.split(" ");
    const servicesFor = (p) => p.services.map((s) => SERVICES.find((x) => x.slug === s)?.name).filter(Boolean).join(", ");

    const page = (
        <div
            ref={root}
            className={`${styles.root} ${GeistSans.variable} ${phase === "ready" || phase === "leaving" ? styles.isReady : ""}`}
        >
            {/* The 3D stage, fixed behind everything */}
            <div className={styles.stage} aria-hidden="true">
                <LandingScene />
            </div>

            {/* Loader */}
            {phase !== "ready" && (
                <div className={`${styles.loader} ${phase === "leaving" ? styles.loaderOut : ""}`} aria-hidden="true">
                    <MarkOutline />
                </div>
            )}

            {/* Navigation */}
            <header className={`${styles.nav} ${navHidden && !menuOpen ? styles.navHidden : ""}`}>
                <Link href="/" className={styles.brand} aria-label={`${SITE.name} home`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="" width="96" height="96" />
                </Link>
                <nav aria-label="Primary" className={styles.navLinks}>
                    {LINKS.map((l, i) => (
                        <Link
                            key={l.href}
                            href={l.href}
                            aria-label={l.label}
                            onPointerEnter={() => scrambleRefs.current[i]?.scramble()}
                            onFocus={() => scrambleRefs.current[i]?.scramble()}
                        >
                            <ScrambleText ref={(el) => { scrambleRefs.current[i] = el; }} text={l.label} />
                        </Link>
                    ))}
                </nav>
                <Link href="/contact" className={`${styles.navCta} ${styles.liquidButton}`}>
                    <span className={styles.liquid} aria-hidden="true" />
                    <span className={styles.liquidLabel}>Start a project</span>
                </Link>
                <button
                    type="button"
                    className={styles.menuButton}
                    aria-expanded={menuOpen}
                    aria-controls="landing-menu"
                    onClick={() => setMenuOpen((o) => !o)}
                >
                    {menuOpen ? "Close" : "Menu"}
                </button>
            </header>
            {menuOpen && (
                <div id="landing-menu" className={styles.menu}>
                    <nav aria-label="Menu">
                        {LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</Link>)}
                        <Link href="/contact" className={styles.menuCta} onClick={() => setMenuOpen(false)}>Start a project</Link>
                    </nav>
                </div>
            )}

            {/* Section dots */}
            <nav className={styles.dots} aria-label="Sections">
                {DOTS.map((d, i) => (
                    <button
                        key={d.stage}
                        type="button"
                        className={`${styles.dotButton} ${i === activeDot ? styles.dotActive : ""}`}
                        aria-label={d.label}
                        aria-current={i === activeDot ? "true" : undefined}
                        onClick={() => goTo(d.stage)}
                    />
                ))}
            </nav>

            <main className={styles.main}>
                {/* Hero */}
                <section className={styles.hero} data-stage="hero" aria-labelledby="hero-title">
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrow}>
                            Innovate<span className={styles.sep} aria-hidden="true" />Build<span className={styles.sep} aria-hidden="true" />Grow
                        </p>
                        <h1 id="hero-title" className={styles.heroTitle}>
                            <span className={styles.line}><span className={styles.silver}>Give your</span></span>
                            <span className={styles.line}><span>business</span></span>
                            <span className={styles.line}><span>an <span className={styles.tealWord}>aura.</span></span></span>
                        </h1>
                        <div className={styles.heroAside}>
                            <p>Modern solutions, powered by technology.<br />Designed for what&apos;s next.</p>
                            <div className={styles.actions}>
                                <Link href="/contact" className={`${styles.buttonGlow} ${styles.liquidButton}`}>
                                    <span className={styles.liquid} aria-hidden="true" />
                                    <span className={styles.liquidLabel}>Start a project</span>
                                </Link>
                                <Link href="/work" className={styles.underlineLink}>See our work</Link>
                            </div>
                        </div>
                    </div>
                    <div className={styles.scrollExplore} aria-hidden="true">
                        <span>Scroll to explore</span>
                        <i />
                    </div>
                    <button type="button" className={styles.mouse} aria-label="Scroll down" onClick={() => goTo("statement")}>
                        <Arrow down />
                    </button>
                </section>

                {/* Statement */}
                <section className={styles.statement} data-stage="statement" aria-label="What we believe">
                    <p ref={statementRef} className={styles.statementText}>
                        {words.map((w, i) => (
                            <span key={i} ref={(el) => { wordRefs.current[i] = el; }} className={styles.word}>{w} </span>
                        ))}
                    </p>
                </section>

                {/* Services */}
                <section className={styles.services} data-stage="services" aria-labelledby="services-title">
                    <div className={styles.sectionHead}>
                        <h2 id="services-title" className={styles.sectionTitle}>What we do</h2>
                        <p className={styles.sectionIntro}>Seven ways we help, from the first idea to the growth that comes after launch.</p>
                    </div>
                    <ul className={styles.rows}>
                        {SERVICES.map((s) => (
                            <li key={s.slug}>
                                <Link
                                    href={`/services/${s.slug}`}
                                    className={styles.row}
                                    onPointerEnter={() => { landing.hoverTint = s.tint; }}
                                    onPointerLeave={() => { landing.hoverTint = null; }}
                                    onFocus={() => { landing.hoverTint = s.tint; }}
                                    onBlur={() => { landing.hoverTint = null; }}
                                >
                                    <span className={styles.rowName}>{s.name}</span>
                                    <span className={styles.rowSummary}>{s.summary}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Selected work */}
                {work && (
                    <section className={styles.work} data-stage="work" aria-labelledby="work-title">
                        <div className={styles.sectionHead}>
                            <h2 id="work-title" className={styles.sectionTitle}>Selected work</h2>
                            <Link href="/work" className={styles.textLink}>All work</Link>
                        </div>
                        <Link href={`/work/${work.slug}`} className={styles.workCard}>
                            <span className={styles.workMedia}>
                                {/* still covers only (the looping videos were removed on request) */}
                                {work.cover ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={work.cover} alt="" />
                                ) : null}
                            </span>
                            <span className={styles.workCaption}>
                                <span className={styles.workName}>{work.name}</span>
                                <span className={styles.workSummary}>{work.summary}</span>
                                <span className={styles.workServices}>{servicesFor(work)}</span>
                            </span>
                        </Link>
                    </section>
                )}

                {/* How we work: a real sequence, so the steps are numbered */}
                <section className={styles.process} data-stage="process" aria-labelledby="process-title">
                    <div className={styles.sectionHead}>
                        <h2 id="process-title" className={styles.sectionTitle}>How we work</h2>
                    </div>
                    <ol className={styles.steps}>
                        {STEPS.map((s) => (
                            <li key={s.title}>
                                <h3>{s.title}</h3>
                                <p>{s.text}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* Call to action */}
                <section className={styles.cta} data-stage="cta" aria-labelledby="cta-title">
                    <h2 id="cta-title" className={styles.ctaTitle}>Have a project in mind?</h2>
                    <p>Tell us what you&apos;re building and we&apos;ll get back to you.</p>
                    <Link href="/contact" className={styles.buttonPrimary}>Start a project</Link>
                </section>
            </main>

            <div className={styles.footerWrap} data-stage="footer">
                <SiteFooter />
            </div>
        </div>
    );

    // Smooth scrolling (switched off with reduced motion, see below)
    return (
        <ReactLenis root ref={lenisRef} options={{ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 }}>
            {page}
        </ReactLenis>
    );
}
