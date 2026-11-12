import Link from "next/link";
import { notFound } from "next/navigation";
import Station from "@/components/world/Station";
import ProjectBand from "@/components/site/ProjectBand";
import { SERVICES, getService } from "@/content/services";
import { PROJECTS } from "@/content/work";
import styles from "@/components/site/site.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
    return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const service = getService(slug);
    if (!service) return {};
    return {
        title: `${service.name} | Aura Infotech`,
        description: service.summary,
    };
}

// "A, B and C" for the tools sentence
const joinList = (items) =>
    items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

export default async function ServicePage({ params }) {
    const { slug } = await params;
    const service = getService(slug);
    if (!service) notFound();

    const related = PROJECTS.filter((p) => p.services.includes(service.slug)).slice(0, 3);
    const others = SERVICES.filter((s) => s.slug !== service.slug);

    return (
        <main>
            <Station name="service" tint={service.tint} />
            <div className={styles.wrap}>
                <header className={`${styles.hero} ${styles.column}`}>
                    <span className={styles.tintMark} style={{ background: service.tint }} aria-hidden="true" />
                    <h1 className={styles.title}>{service.name}</h1>
                    <p className={styles.lead}>{service.promise}</p>
                    <div className={styles.actions}>
                        <Link href={`/contact?service=${service.slug}`} className={styles.buttonPrimary}>Start a project</Link>
                    </div>
                </header>

                <section className={styles.section} aria-labelledby="intro-title">
                    <div className={`${styles.column} ${styles.prose}`}>
                        <h2 id="intro-title" className={styles.sectionTitle}>How we approach it</h2>
                        <p>{service.intro}</p>
                    </div>
                </section>

                <section className={styles.section} aria-labelledby="deliver-title">
                    <div className={styles.column}>
                        <h2 id="deliver-title" className={styles.sectionTitle}>What you get</h2>
                        <ul className={styles.deliverables}>
                            {service.deliverables.map((d) => <li key={d}>{d}</li>)}
                        </ul>
                    </div>
                </section>

                <section className={styles.section} aria-labelledby="process-title">
                    <div className={styles.column}>
                        <h2 id="process-title" className={styles.sectionTitle}>How a project runs</h2>
                        <ol className={styles.steps}>
                            {service.process.map((p) => (
                                <li key={p.step}>
                                    <span className={styles.stepName}>{p.step}</span>
                                    <span className={styles.stepText}>{p.detail}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {service.tools.length > 0 && (
                    <section className={styles.section} aria-labelledby="tools-title">
                        <div className={`${styles.column} ${styles.prose}`}>
                            <h2 id="tools-title" className={styles.sectionTitle}>Tools</h2>
                            <p>We usually work with {joinList(service.tools)}, and adapt to what your team already uses.</p>
                        </div>
                    </section>
                )}

                {related.length > 0 && (
                    <section className={styles.section} aria-labelledby="related-title">
                        <div className={styles.column}>
                            <h2 id="related-title" className={styles.sectionTitle}>Related work</h2>
                            <ul className={styles.projects}>
                                {related.map((p) => (
                                    <li key={p.slug}>
                                        <Link href={`/work/${p.slug}`} className={styles.projectLink}>
                                            <div className={styles.projectName}>{p.name}</div>
                                            <div className={styles.projectMeta}>{p.client}</div>
                                            <div className={styles.projectResult}>{p.result}</div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>
                )}

                {service.faqs.length > 0 && (
                    <section className={styles.section} aria-labelledby="faq-title">
                        <div className={`${styles.column} ${styles.faq}`}>
                            <h2 id="faq-title" className={styles.sectionTitle}>Questions</h2>
                            {service.faqs.map((f) => (
                                <details key={f.q}>
                                    <summary>{f.q}</summary>
                                    <p>{f.a}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                )}

                <section className={styles.section} aria-labelledby="others-title">
                    <div className={styles.column}>
                        <h2 id="others-title" className={styles.sectionTitle}>Other services</h2>
                        <ul className={styles.otherServices}>
                            {others.map((s) => (
                                <li key={s.slug}><Link href={`/services/${s.slug}`} className={styles.textLink}>{s.name}</Link></li>
                            ))}
                        </ul>
                    </div>
                </section>
            </div>
            <ProjectBand service={service.slug} />
        </main>
    );
}
