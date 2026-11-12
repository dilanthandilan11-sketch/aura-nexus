import Link from "next/link";
import { notFound } from "next/navigation";
import Station from "@/components/world/Station";
import ProjectBand from "@/components/site/ProjectBand";
import { PROJECTS, getProject } from "@/content/work";
import { SERVICES } from "@/content/services";
import styles from "@/components/site/site.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
    return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const project = getProject(slug);
    if (!project) return {};
    return {
        title: `${project.name} | Work | Aura Infotech`,
        description: project.summary,
    };
}

export default async function ProjectPage({ params }) {
    const { slug } = await params;
    const project = getProject(slug);
    if (!project) notFound();

    const index = PROJECTS.findIndex((p) => p.slug === project.slug);
    const next = PROJECTS[(index + 1) % PROJECTS.length];
    const serviceNames = project.services
        .map((s) => SERVICES.find((x) => x.slug === s))
        .filter(Boolean);

    return (
        <main>
            <Station name="project" />
            <div className={styles.wrap}>
                <header className={`${styles.hero} ${styles.column}`}>
                    <h1 className={styles.title}>{project.name}</h1>
                    <p className={styles.lead}>{project.summary}</p>
                    <dl className={styles.facts}>
                        <div><dt>Client</dt><dd>{project.client}</dd></div>
                        <div><dt>Industry</dt><dd>{project.industry}</dd></div>
                        <div><dt>Year</dt><dd>{project.year}</dd></div>
                        <div>
                            <dt>Services</dt>
                            <dd>
                                {serviceNames.map((s, i) => (
                                    <span key={s.slug}>
                                        {i > 0 ? ", " : ""}
                                        <Link href={`/services/${s.slug}`} className={styles.textLink}>{s.name}</Link>
                                    </span>
                                ))}
                            </dd>
                        </div>
                        {project.liveUrl ? (
                            <div>
                                <dt>Live site</dt>
                                <dd><a href={project.liveUrl} className={styles.textLink} target="_blank" rel="noopener noreferrer">Visit the site</a></dd>
                            </div>
                        ) : null}
                    </dl>
                </header>

                {project.cover ? (
                    <div className={styles.frame}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={project.cover} alt={`${project.name} cover`} />
                    </div>
                ) : null}

                <section className={styles.section} aria-labelledby="challenge-title">
                    <div className={`${styles.column} ${styles.prose}`}>
                        <h2 id="challenge-title" className={styles.sectionTitle}>The challenge</h2>
                        <p>{project.challenge}</p>
                    </div>
                </section>

                {project.approach.length > 0 && (
                    <section className={styles.section} aria-labelledby="approach-title">
                        <h2 id="approach-title" className={styles.sectionTitle}>What we did</h2>
                        <div className={styles.approach}>
                            {project.approach.map((a, i) => (
                                <div key={`${a.title}-${i}`}>
                                    <h3>{a.title}</h3>
                                    <p>{a.detail}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {project.results.length > 0 && (
                    <section className={styles.section} aria-labelledby="results-title">
                        <h2 id="results-title" className={styles.sectionTitle}>Results</h2>
                        <dl className={styles.results}>
                            {project.results.map((r, i) => (
                                <div key={i} className={styles.resultItem}>
                                    <dt>{r.label}</dt>
                                    <dd>{r.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                )}

                {project.gallery.length > 0 && (
                    <section className={styles.section} aria-label="Gallery">
                        <div className={styles.gallery}>
                            {project.gallery.map((src, i) => (
                                <div key={src} className={styles.frame}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={src} alt={`${project.name}, image ${i + 1}`} loading="lazy" />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {next && next.slug !== project.slug ? (
                    <section className={styles.section} aria-label="Next project">
                        <Link href={`/work/${next.slug}`} className={styles.nextProject}>
                            <div className={styles.nextLabel}>Next project</div>
                            <div className={styles.nextName}>{next.name}</div>
                        </Link>
                    </section>
                ) : null}
            </div>
            <ProjectBand />
        </main>
    );
}
