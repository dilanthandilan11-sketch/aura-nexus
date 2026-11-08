import Station from "@/components/world/Station";
import WorkList from "@/components/site/WorkList";
import ProjectBand from "@/components/site/ProjectBand";
import { PROJECTS } from "@/content/work";
import { SERVICES } from "@/content/services";
import styles from "@/components/site/site.module.css";

export const metadata = {
    title: "Work | Aura Infotech",
    description: "Selected projects by Aura Infotech.",
};

export default function WorkPage() {
    return (
        <main className={styles.flip}>
            <Station name="work" />
            <div className={styles.wrap}>
                <header className={`${styles.hero} ${styles.column}`}>
                    <h1 className={styles.title}>Selected work</h1>
                    <p className={styles.lead}>
                        A few projects, what the client needed and what changed after we shipped.
                    </p>
                </header>
                <section className={styles.section} aria-label="Projects">
                    <div className={styles.column}>
                        <WorkList projects={PROJECTS} services={SERVICES.map(({ slug, name, tint }) => ({ slug, name, tint }))} />
                    </div>
                </section>
            </div>
            <ProjectBand />
        </main>
    );
}
