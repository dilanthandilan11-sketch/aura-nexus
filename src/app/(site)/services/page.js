import Station from "@/components/world/Station";
import ServicesSpectrum from "@/components/site/ServicesSpectrum";
import ProjectBand from "@/components/site/ProjectBand";
import { SERVICES } from "@/content/services";
import styles from "@/components/site/site.module.css";

export const metadata = {
    title: "Services | Aura Infotech",
    description: "Software, websites, marketing, design, UI/UX, SEO and data analysis from Aura Infotech.",
};

export default function ServicesPage() {
    return (
        <main>
            <Station name="services" />
            <div className={styles.wrap}>
                <header className={`${styles.hero} ${styles.column}`}>
                    <h1 className={styles.title}>What we build</h1>
                    <p className={styles.lead}>
                        Seven services that work on their own or together, from the first sketch to the numbers after launch.
                    </p>
                </header>

                <section className={styles.section} aria-label="Our services">
                    <div className={styles.column}>
                        <ServicesSpectrum services={SERVICES} />
                    </div>
                </section>
            </div>
            <ProjectBand />
        </main>
    );
}
