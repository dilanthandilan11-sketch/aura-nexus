// src/components/site/LegalPage.jsx
// Shared layout for the privacy policy and terms (content in src/content/legal.js)
import Station from "@/components/world/Station";
import styles from "@/components/site/site.module.css";

const anchor = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function LegalPage({ doc }) {
    return (
        <main>
            <Station name="legal" />
            <div className={styles.wrap}>
                <header className={`${styles.hero} ${styles.column}`}>
                    <h1 className={styles.title}>{doc.title}</h1>
                    <p className={styles.lead}>Last updated {doc.updated}</p>
                </header>
                <div className={`${styles.section} ${styles.legal}`}>
                    <nav aria-label="On this page">
                        <ul className={styles.toc}>
                            {doc.sections.map((s) => (
                                <li key={s.heading}><a href={`#${anchor(s.heading)}`} className={styles.textLink}>{s.heading}</a></li>
                            ))}
                        </ul>
                    </nav>
                    {doc.sections.map((s) => (
                        <section key={s.heading} id={anchor(s.heading)}>
                            <h2>{s.heading}</h2>
                            {s.body.map((p, i) => <p key={i}>{p}</p>)}
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
}
