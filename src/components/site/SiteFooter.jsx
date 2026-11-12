// src/components/site/SiteFooter.jsx
// The footer on every page except Home: a slab of liquid glass over the 3D
// world (drawn by LiquidFooter in the canvas), with the logo top-left, the
// links on a frosted panel, and the logo carved in glass along the bottom,
// as wide as the content. While the footer slides under the navbar, the
// navbar fades out (see siteNav.module.css: data-footer-under-nav).
// Arrival: when it scrolls into view the liquid rises into it (LiquidFooter),
// the content fades in as the liquid reaches it, then the glass logo
// surfaces. It plays once per page.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE, CONTACT, SOCIALS } from "@/content/site";
import { SERVICES } from "@/content/services";
import { footerGlass } from "@/components/world/footerGlass";
import styles from "@/components/site/site.module.css";

const NAV_HEIGHT = 110;   // px from the top of the screen that the navbar covers

export default function SiteFooter() {
    const year = new Date().getFullYear();
    const socials = SOCIALS.filter((s) => s.url);

    // Tell the glass where the footer and the wordmark are
    const footerRef = useCallback((el) => { footerGlass.footer = el; }, []);
    const markRef = useCallback((el) => { footerGlass.mark = el; }, []);

    // Arrival: start when the footer comes into view; again on each new page
    const pathname = usePathname();
    const [arrived, setArrived] = useState(false);
    useEffect(() => {
        setArrived(false);
        footerGlass.startedAt = null;
        const el = footerGlass.footer;
        if (!el) return undefined;
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                footerGlass.startedAt = performance.now();
                setArrived(true);
                io.disconnect();
            }
        }, { rootMargin: "0px 0px -18% 0px" });
        io.observe(el);
        return () => io.disconnect();
    }, [pathname]);

    // Fade the navbar out while the footer is underneath it
    useEffect(() => {
        const html = document.documentElement;
        let frame = 0;
        const check = () => {
            frame = 0;
            const top = footerGlass.footer?.getBoundingClientRect().top ?? Infinity;
            if (top < NAV_HEIGHT) html.dataset.footerUnderNav = "";
            else delete html.dataset.footerUnderNav;
        };
        const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
        check();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            delete html.dataset.footerUnderNav;
        };
    }, []);

    return (
        <footer ref={footerRef} className={`${styles.footer} ${arrived ? styles.footerIn : ""}`}>
            <div className={styles.wrap}>
                <div className={styles.footerTop}>
                    <div className={styles.footerBrand}>
                        <Link href="/" className={styles.footerLogo} aria-label={`${SITE.name} home`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo.png" alt="" width="90" height="90" />
                        </Link>
                        <p>{SITE.pitch}</p>
                    </div>

                    <div className={styles.footerPanel}>
                        <nav aria-label="Services" className={styles.footerCol}>
                            <h2 className={styles.footerHeading}>Services</h2>
                            <ul>
                                {SERVICES.map((s) => (
                                    <li key={s.slug}><Link href={`/services/${s.slug}`}>{s.name}</Link></li>
                                ))}
                            </ul>
                        </nav>

                        <nav aria-label="Company" className={styles.footerCol}>
                            <h2 className={styles.footerHeading}>Company</h2>
                            <ul>
                                <li><Link href="/work">Work</Link></li>
                                <li><Link href="/about">About</Link></li>
                                <li><Link href="/contact">Contact</Link></li>
                            </ul>
                        </nav>

                        <div className={styles.footerCol}>
                            <h2 className={styles.footerHeading}>Get in touch</h2>
                            <ul>
                                <li><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
                                {CONTACT.phone ? <li><a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}>{CONTACT.phone}</a></li> : null}
                                {CONTACT.location ? <li className={styles.footerQuiet}>{CONTACT.location}</li> : null}
                                {socials.map((s) => (
                                    <li key={s.label}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className={styles.footerBase}>
                    <p>© {year} {SITE.name}</p>
                    <ul>
                        <li><Link href="/privacy">Privacy</Link></li>
                        <li><Link href="/terms">Terms</Link></li>
                    </ul>
                </div>

                {/* The glass logo is drawn by the 3D canvas into this box */}
                <div ref={markRef} className={styles.footerMark} aria-hidden="true" />
            </div>
        </footer>
    );
}
