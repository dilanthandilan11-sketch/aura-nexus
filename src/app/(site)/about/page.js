import Station from "@/components/world/Station";
import ProjectBand from "@/components/site/ProjectBand";
import { ABOUT } from "@/content/about";
import styles from "@/components/site/site.module.css";

export const metadata = {
    title: "About | Aura Infotech",
    description: "Who Aura Infotech is, how we work and the people behind it.",
};

// Initials for a team member without a photo
const initials = (name) =>
    name.replace(/[\[\]]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "A";

export default function AboutPage() {
    return (
        <main>
            <Station name="about" />
            <div className={styles.wrap}>
                <header className={`${styles.hero} ${styles.column}`}>
                    <h1 className={styles.title}>{ABOUT.heading}</h1>
                    <p className={styles.lead}>{ABOUT.intro}</p>
                </header>

                <section className={styles.section} aria-labelledby="story-title">
                    <div className={`${styles.column} ${styles.prose}`}>
                        <h2 id="story-title" className={styles.sectionTitle}>Our story</h2>
                        {ABOUT.story.map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                </section>

                {ABOUT.timeline.length > 0 && (
                    <section className={styles.section} aria-labelledby="timeline-title">
                        <h2 id="timeline-title" className={styles.sectionTitle}>Along the way</h2>
                        <ol className={styles.timeline}>
                            {ABOUT.timeline.map((m, i) => (
                                <li key={i}>
                                    <div className={styles.timelineYear}>{m.year}</div>
                                    <div className={styles.timelineText}>{m.text}</div>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                <section className={styles.section} aria-labelledby="values-title">
                    <h2 id="values-title" className={styles.sectionTitle}>What we care about</h2>
                    <div className={styles.values}>
                        {ABOUT.values.map((v, i) => (
                            <div key={i}>
                                <h3>{v.title}</h3>
                                <p>{v.text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.section} aria-labelledby="process-title">
                    <div className={styles.column}>
                        <h2 id="process-title" className={styles.sectionTitle}>How we work</h2>
                        <ol className={styles.steps}>
                            {ABOUT.process.map((p) => (
                                <li key={p.step}>
                                    <span className={styles.stepName}>{p.step}</span>
                                    <span className={styles.stepText}>{p.text}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {ABOUT.team.length > 0 && (
                    <section className={styles.section} aria-labelledby="team-title">
                        <h2 id="team-title" className={styles.sectionTitle}>The team</h2>
                        <ul className={styles.team}>
                            {ABOUT.team.map((m, i) => (
                                <li key={i}>
                                    <div className={styles.portrait}>
                                        {m.photo ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={m.photo} alt={m.name} loading="lazy" />
                                        ) : (
                                            <span aria-hidden="true">{initials(m.name)}</span>
                                        )}
                                    </div>
                                    <div className={styles.teamName}>{m.name}</div>
                                    <div className={styles.teamRole}>{m.role}</div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
            <ProjectBand />
        </main>
    );
}
