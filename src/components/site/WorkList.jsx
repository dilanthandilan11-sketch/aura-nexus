// src/components/site/WorkList.jsx
// Project cards on /work, with a filter by service.
//
// Hover a card (mouse): it flies toward the middle of the screen making one
// full turn, and while it is still turning it stretches into the large
// landscape panel; everything behind it blurs and dims. The card is swapped
// for the panel at three-quarters of the turn, when it is edge-on, so the
// flip, the flight and the growth read as one move.
// Moving the pointer away plays it back: the panel shrinks to the card, the
// card flies home and the blur clears. Clicking the card or the panel opens the
// project's own page.
// Touch screens (no hover): the first tap plays the sequence, a tap on the
// panel opens the project, a tap anywhere else closes it.
// Keyboard: a focused card lifts; Enter opens the project.
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { setHoverTint } from "@/components/world/worldStore";
import styles from "@/components/site/site.module.css";

const INTENT_MS = 70;    // a pointer just brushing past doesn't start it
const GO_MS     = 420;   // card: first three-quarters of the turn, on its way
const OPEN_MS   = 560;   // panel: last quarter of the turn while it grows
const CLOSE_MS  = 360;   // the same, played back
const BACK_MS   = 380;
const LEAVE_MS  = 120;   // grace period before closing (pointer crossing a gap)
const CENTER_SCALE = 1.2;  // the card's size once it would reach the middle
const HANDOFF = 0.6;       // how far toward the middle the card gets before the panel takes over
const PERSPECTIVE = "perspective(1600px)";

// Speeding up into the hand-off, slowing down out of it: one continuous move
const EASE_GO    = "cubic-bezier(0.5, 0, 0.9, 0.55)";
const EASE_OPEN  = "cubic-bezier(0.12, 0.6, 0.25, 1)";
const EASE_CLOSE = "cubic-bezier(0.75, 0, 0.88, 0.4)";
const EASE_BACK  = "cubic-bezier(0.1, 0.45, 0.5, 1)";

const inside = (r, x, y, pad = 0) =>
    r && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;

// Where the card sits once it has flown to the middle of the screen
function centreOf(card) {
    const w = card.width * CENTER_SCALE;
    const h = card.height * CENTER_SCALE;
    const left = (window.innerWidth - w) / 2;
    const top = (window.innerHeight - h) / 2;
    return { left, top, width: w, height: h, right: left + w, bottom: top + h };
}

// Where the card is when the panel takes over: part way to the middle
function handoffOf(from, centre) {
    const lerp = (a, b) => a + (b - a) * HANDOFF;
    const width = lerp(from.width, centre.width);
    const height = lerp(from.height, centre.height);
    const cx = lerp(from.left + from.width / 2, centre.left + centre.width / 2);
    const cy = lerp(from.top + from.height / 2, centre.top + centre.height / 2);
    const left = cx - width / 2, top = cy - height / 2;
    return { left, top, width, height, right: left + width, bottom: top + height };
}

// The panel grows out of the card without stretching anything: it is scaled
// evenly (so the image and text keep their shape) and cropped to the card's
// outline, then both open up to the full panel. Returns that start keyframe.
const CARD_RADIUS = 14;
const PANEL_RADIUS = 22;
function asCard(card, panel) {
    const s = Math.max(card.width / panel.width, card.height / panel.height);
    const dx = (card.left + card.width / 2) - (panel.left + panel.width / 2);
    const dy = (card.top + card.height / 2) - (panel.top + panel.height / 2);
    const ix = Math.max(0, (panel.width - card.width / s) / 2);
    const iy = Math.max(0, (panel.height - card.height / s) / 2);
    return {
        transform: `${PERSPECTIVE} translate(${dx}px, ${dy}px) scale(${s}) rotateY(-90deg)`,
        clipPath: `inset(${iy}px ${ix}px round ${CARD_RADIUS / s}px)`,
    };
}
const FULL = {
    transform: `${PERSPECTIVE} translate(0px, 0px) scale(1) rotateY(0deg)`,
    clipPath: `inset(0px 0px round ${PANEL_RADIUS}px)`,
};

/* ── The cover: the project's image, or a tinted placeholder frame ─────── */
function Cover({ project, tint, large = false }) {
    if (project.cover) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img className={styles.cardCoverImg} src={project.cover} alt="" />;
    }
    return (
        <div className={styles.cardCoverEmpty} style={{ "--tint": tint }} aria-hidden="true">
            {large && <span className={styles.cardCoverNote}>Project image</span>}
        </div>
    );
}

/* ── The card's two faces (used by the card and by its flying copy) ────── */
function Faces({ project, tint, names }) {
    const services = project.services.map((s) => names[s]).filter(Boolean);
    return (
        <>
            <span className={styles.cardFace}>
                <span className={styles.cardCover}>
                    <Cover project={project} tint={tint} />
                </span>
                <span className={styles.cardText}>
                    <span className={styles.cardName}>{project.name}</span>
                    <span className={styles.cardMeta}>
                        {services[0]}{services.length > 1 ? ` +${services.length - 1}` : ""}
                    </span>
                </span>
            </span>
            {/* Back: seen halfway through the turn */}
            <span className={`${styles.cardFace} ${styles.cardBack}`} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="" className={styles.cardBackMark} />
            </span>
        </>
    );
}

/* ── The flying copy of the card ─────────────────────────────────────────
 * Sits fixed over the card and turns three-quarters on its way toward the
 * middle ("go"), ending edge-on where the panel takes over. "back" plays that
 * in reverse after the panel has shrunk away. */
function Traveller({ project, tint, names, from, to, mode, onHome }) {
    const ref = useRef(null);
    const turnRef = useRef(null);

    useLayoutEffect(() => {
        const el = ref.current;
        const turn = turnRef.current;
        const dx = to.left - from.left;
        const dy = to.top - from.top;
        const s = to.width / from.width;
        const home = { transform: "translate(0px, 0px) scale(1)" };
        const there = { transform: `translate(${dx}px, ${dy}px) scale(${s})` };
        const flat = { transform: "rotateY(0deg)" };
        const edge = { transform: "rotateY(270deg)" };

        if (mode === "go") {
            el.animate([home, there], { duration: GO_MS, easing: EASE_GO, fill: "forwards" });
            turn.animate([flat, edge], { duration: GO_MS, easing: EASE_GO, fill: "forwards" });
            return undefined;
        }
        // "back"
        const a = el.animate([there, home], { duration: BACK_MS, easing: EASE_BACK, fill: "forwards" });
        turn.animate([edge, flat], { duration: BACK_MS, easing: EASE_BACK, fill: "forwards" });
        a.onfinish = onHome;
        return () => { a.onfinish = null; };
        // from / to are fixed for one trip
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    return (
        <div
            ref={ref}
            className={styles.traveller}
            style={{ left: from.left, top: from.top, width: from.width, height: from.height, "--tint": tint }}
            aria-hidden="true"
        >
            <span ref={turnRef} className={styles.cardTurn}>
                <Faces project={project} tint={tint} names={names} />
            </span>
        </div>
    );
}

/* ── The expanded panel ─────────────────────────────────────────────────── */
function Panel({ project, tint, names, centre, closing, onPointerOver, onClosed, panelRectRef }) {
    const ref = useRef(null);
    const bodyRef = useRef(null);

    // Open: finish the turn while growing from the card into the panel.
    // (The layout box is measured without the transform, so this is the
    // panel's real place.)
    useLayoutEffect(() => {
        const el = ref.current;
        const final = el.getBoundingClientRect();
        panelRectRef.current = final;
        el.animate([asCard(centre, final), FULL], { duration: OPEN_MS, easing: EASE_OPEN });
        bodyRef.current?.animate(
            [{ opacity: 0, transform: "translateY(10px)", filter: "blur(5px)" },
             { opacity: 1, transform: "none", filter: "blur(0)" }],
            { duration: 340, delay: OPEN_MS * 0.4, easing: EASE_OPEN, fill: "backwards" }
        );
        // Only on mount; closing is handled below
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close: the same move played back, ending edge-on where the card takes over
    useEffect(() => {
        if (!closing) return;
        const el = ref.current;
        el.getAnimations().forEach((a) => a.cancel());
        const final = el.getBoundingClientRect();
        bodyRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" });
        const anim = el.animate([FULL, asCard(centre, final)], { duration: CLOSE_MS, easing: EASE_CLOSE, fill: "forwards" });
        anim.onfinish = onClosed;
        return () => { anim.onfinish = null; };
    }, [closing, centre, onClosed]);

    const services = project.services.map((s) => names[s]).filter(Boolean).join(", ");

    return (
        <Link
            ref={ref}
            href={`/work/${project.slug}`}
            className={styles.panel}
            style={{ "--tint": tint }}
            onPointerMove={onPointerOver}
            aria-label={`${project.name}, open the project`}
        >
            <div className={styles.panelCover}>
                <Cover project={project} tint={tint} large />
            </div>
            <div ref={bodyRef} className={styles.panelBody}>
                <p className={styles.panelMeta}>{project.client}, {project.year}</p>
                <h2 className={styles.panelName}>{project.name}</h2>
                <p className={styles.panelSummary}>{project.summary}</p>
                <p className={styles.panelResult}>{project.result}</p>
                <p className={styles.panelServices}>{services}</p>
                <span className={styles.panelCta}>View project</span>
            </div>
        </Link>
    );
}

/* Mounts its child after `ms` (the panel waits for the card's three-quarter turn) */
function Delayed({ ms, children }) {
    const [ready, setReady] = useState(ms === 0);
    useEffect(() => {
        if (ready) return undefined;
        const t = setTimeout(() => setReady(true), ms);
        return () => clearTimeout(t);
    }, [ms, ready]);
    return ready ? children : null;
}

/* ── One card in the grid ───────────────────────────────────────────────── */
function Card({ project, tint, names, lifted, away, onStart, onTap, cardRef }) {
    return (
        <li className={`${styles.cardSlot} ${lifted ? styles.cardLifted : ""}`}>
            <Link
                ref={cardRef}
                href={`/work/${project.slug}`}
                className={`${styles.card} ${away ? styles.cardHidden : ""}`}
                style={{ "--tint": tint }}
                onPointerEnter={(e) => { if (e.pointerType === "mouse") onStart(); }}
                // Capture: runs before the page-change handler (SiteShell), so
                // a first tap on touch can play the sequence instead of leaving
                onClickCapture={onTap}
            >
                <span className={styles.cardTurn}>
                    <Faces project={project} tint={tint} names={names} />
                </span>
            </Link>
        </li>
    );
}

/* ── The list ───────────────────────────────────────────────────────────── */
export default function WorkList({ projects, services }) {
    const [filter, setFilter] = useState("all");
    const names = useMemo(() => Object.fromEntries(services.map((s) => [s.slug, s.name])), [services]);
    const tints = useMemo(() => Object.fromEntries(services.map((s) => [s.slug, s.tint])), [services]);
    const tintOf = useCallback((p) => tints[p.services[0]] ?? "#1CE3DA", [tints]);

    const used = services.filter((s) => projects.some((p) => p.services.includes(s.slug)));
    const shown = filter === "all" ? projects : projects.filter((p) => p.services.includes(filter));

    // phase: null -> "lift" (intent) -> "open" (card turn, then panel) -> "closing" -> "back" -> null
    const [active, setActive] = useState(null);
    const [phase, setPhase] = useState(null);
    const [trip, setTrip] = useState(null);           // { from, to } rects for the flight
    const [mounted, setMounted] = useState(false);
    const [hover, setHover] = useState(true);

    const cardEls = useRef({});
    const panelRect = useRef(null);
    const timers = useRef({ lift: 0, close: 0 });
    const openedAt = useRef(0);                       // when the current open started

    useEffect(() => {
        setMounted(true);
        setHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
        const t = timers.current;
        return () => { clearTimeout(t.lift); clearTimeout(t.close); setHoverTint(null); };
    }, []);

    const reset = useCallback(() => {
        clearTimeout(timers.current.lift);
        clearTimeout(timers.current.close);
        timers.current.close = 0;
        panelRect.current = null;
        setActive(null);
        setPhase(null);
        setTrip(null);
        setHoverTint(null);
    }, []);

    const start = useCallback((slug, { immediate = false } = {}) => {
        if (active) return;                            // one card at a time
        const p = projects.find((x) => x.slug === slug);
        if (p) setHoverTint(tintOf(p));
        setActive(slug);
        setPhase("lift");
        clearTimeout(timers.current.lift);
        timers.current.lift = setTimeout(() => {
            const el = cardEls.current[slug];
            if (!el) return;
            const from = el.getBoundingClientRect();
            setTrip({ from, to: handoffOf(from, centreOf(from)) });
            openedAt.current = performance.now();
            setPhase("open");   // card and panel run back to back as one move
        }, immediate ? 0 : INTENT_MS);
    }, [active, projects, tintOf]);

    const close = useCallback(() => {
        clearTimeout(timers.current.close);
        timers.current.close = 0;
        if (phase === "lift") { reset(); return; }     // never left its place
        if (phase === "open") {
            // Let the move finish before playing it back, so it never jerks
            const left = GO_MS + OPEN_MS * 0.7 - (performance.now() - openedAt.current);
            if (left > 0) {
                timers.current.close = setTimeout(() => { timers.current.close = 0; setHoverTint(null); setPhase("closing"); }, left);
                return;
            }
            setHoverTint(null);
            setPhase("closing");
        }
    }, [phase, reset]);

    const panelClosed = useCallback(() => setPhase("back"), []);

    // Mouse: stay open while the pointer is over the card's place or the panel
    useEffect(() => {
        if (!active || !hover || phase === "closing" || phase === "back") return;
        const onMove = (e) => {
            const home = cardEls.current[active]?.getBoundingClientRect();
            const over = inside(home, e.clientX, e.clientY, 8) ||
                         (phase === "open" && inside(panelRect.current, e.clientX, e.clientY));
            if (over) {
                clearTimeout(timers.current.close);
                timers.current.close = 0;
            } else if (!timers.current.close) {
                timers.current.close = setTimeout(() => { timers.current.close = 0; close(); }, LEAVE_MS);
            }
        };
        const onOut = (e) => { if (!e.relatedTarget) close(); };   // left the window
        window.addEventListener("pointermove", onMove);
        document.addEventListener("pointerout", onOut);
        return () => {
            window.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerout", onOut);
        };
    }, [active, phase, hover, close]);

    // Touch: a tap outside the panel closes it. Escape closes it everywhere.
    useEffect(() => {
        if (!active) return;
        const onKey = (e) => { if (e.key === "Escape") close(); };
        const onDown = (e) => {
            if (hover || phase !== "open") return;
            if (!inside(panelRect.current, e.clientX, e.clientY)) close();
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("pointerdown", onDown);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("pointerdown", onDown);
        };
    }, [active, phase, hover, close]);

    // Changing the filter closes anything open
    useEffect(() => { reset(); }, [filter, reset]);

    const activeProject = projects.find((p) => p.slug === active);
    const away = (slug) => active === slug && phase && phase !== "lift";
    const travelling = mounted && activeProject && trip && phase && phase !== "lift";

    return (
        <>
            <ul className={styles.filters} aria-label="Filter projects by service">
                <li>
                    <button type="button" className={styles.filterButton} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                        All work
                    </button>
                </li>
                {used.map((s) => (
                    <li key={s.slug}>
                        <button type="button" className={styles.filterButton} aria-pressed={filter === s.slug} onClick={() => setFilter(s.slug)}>
                            {s.name}
                        </button>
                    </li>
                ))}
            </ul>

            {shown.length === 0 ? (
                <p className={styles.empty}>No projects for this service yet.</p>
            ) : (
                <ul className={styles.cards}>
                    {shown.map((p) => (
                        <Card
                            key={p.slug}
                            project={p}
                            tint={tintOf(p)}
                            names={names}
                            lifted={active === p.slug && phase === "lift"}
                            away={away(p.slug)}
                            cardRef={(el) => { cardEls.current[p.slug] = el; }}
                            onStart={() => start(p.slug)}
                            onTap={(e) => {
                                if (hover) return;                       // mouse: a click opens the page
                                if (active === p.slug && phase === "open") return;
                                e.preventDefault();
                                start(p.slug, { immediate: true });
                            }}
                        />
                    ))}
                </ul>
            )}

            {travelling && createPortal(
                <>
                    {/* Everything behind blurs and dims so only the card is in focus */}
                    <div className={`${styles.focusVeil} ${phase === "back" ? styles.focusVeilOut : ""}`} aria-hidden="true" />
                    <Traveller
                        key={activeProject.slug}
                        project={activeProject}
                        tint={tintOf(activeProject)}
                        names={names}
                        from={trip.from}
                        to={trip.to}
                        mode={phase === "back" ? "back" : "go"}
                        onHome={reset}
                    />
                    {(phase === "open" || phase === "closing") && (
                        <Delayed ms={phase === "open" ? GO_MS : 0}>
                        <Panel
                            project={activeProject}
                            tint={tintOf(activeProject)}
                            names={names}
                            centre={trip.to}
                            closing={phase === "closing"}
                            onPointerOver={() => { clearTimeout(timers.current.close); timers.current.close = 0; }}
                            onClosed={panelClosed}
                            panelRectRef={panelRect}
                        />
                        </Delayed>
                    )}
                </>,
                // Inside the page frame (for its colours and fonts), but outside
                // the animated content layer so "fixed" means the screen
                document.querySelector("[data-site-shell]") ?? document.body
            )}
        </>
    );
}
