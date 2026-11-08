// src/components/site/SiteFooter.jsx
import Link from "next/link";
import { SITE, CONTACT, SOCIALS } from "@/content/site";
import { SERVICES } from "@/content/services";
import styles from "@/components/site/site.module.css";

export default function SiteFooter() {
    const year = new Date().getFullYear();
    const socials = SOCIALS.filter((s) => s.url);

    return (
        <footer className={styles.footer}>
            <div className={styles.wrap}>
                <div className={styles.footerGrid}>
                    <div className={styles.footerBrand}>
                        <Link href="/" className={styles.footerLogo} aria-label={`${SITE.name} home`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo.png" alt="" width="64" height="64" />
                        </Link>
                        <p>{SITE.pitch}</p>
                    </div>

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

                <div className={styles.footerBase}>
                    <p>© {year} {SITE.name}</p>
                    <ul>
                        <li><Link href="/privacy">Privacy</Link></li>
                        <li><Link href="/terms">Terms</Link></li>
                    </ul>
                </div>
            </div>
        </footer>
    );
}
