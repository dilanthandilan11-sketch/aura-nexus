// src/components/site/ProjectBand.jsx
// The "start a project" band shown above the footer on every page but Contact.
import Link from "next/link";
import styles from "@/components/site/site.module.css";

export default function ProjectBand({ service = null }) {
    const href = service ? `/contact?service=${service}` : "/contact";
    return (
        <section className={styles.band} aria-labelledby="project-band-title">
            <div className={styles.wrap}>
                <div className={styles.bandInner}>
                    <h2 id="project-band-title" className={styles.bandTitle}>Have a project in mind?</h2>
                    <p className={styles.bandText}>Tell us what you're building and we'll get back to you.</p>
                    <Link href={href} className={styles.buttonPrimary}>Start a project</Link>
                </div>
            </div>
        </section>
    );
}
