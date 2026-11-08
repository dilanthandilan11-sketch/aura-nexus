// Re-mounts on every navigation: the page text arrives just after the 3D
// world has started travelling to the new page's station.
import styles from "@/components/site/site.module.css";

export default function SiteTemplate({ children }) {
    return <div className={styles.arrive}>{children}</div>;
}
