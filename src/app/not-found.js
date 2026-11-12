// 404: the logo drifting alone, far out in the void
import Link from "next/link";
import SiteShell from "@/components/site/SiteShell";
import Station from "@/components/world/Station";
import styles from "@/components/site/site.module.css";

export const metadata = {
    title: "Page not found | Aura Infotech",
};

export default function NotFound() {
    return (
        <SiteShell>
            <main className={styles.arrive}>
                <Station name="lost" />
                <div className={`${styles.wrap} ${styles.lost}`}>
                    <div className={styles.column}>
                        <h1 className={styles.title}>This page drifted off</h1>
                        <p className={styles.lead}>The link may be old, or the address may have a typo.</p>
                        <div className={styles.actions}>
                            <Link href="/" className={styles.buttonPrimary}>Go to the home page</Link>
                            <Link href="/services" className={styles.buttonGhost}>See our services</Link>
                        </div>
                    </div>
                </div>
            </main>
        </SiteShell>
    );
}
