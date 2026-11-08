// src/components/site/ServicesSpectrum.jsx
// The services list on /services. Hovering or focusing a service re-tints the
// logo's marble to that service's colour; leaving the list puts it back.
"use client";

import Link from "next/link";
import { setHoverTint } from "@/components/world/worldStore";
import styles from "@/components/site/site.module.css";

export default function ServicesSpectrum({ services }) {
    return (
        <ul className={styles.spectrum} onMouseLeave={() => setHoverTint(null)}>
            {services.map((s) => (
                <li key={s.slug}>
                    <Link
                        href={`/services/${s.slug}`}
                        className={styles.spectrumLink}
                        style={{ "--tint": s.tint }}
                        onMouseEnter={() => setHoverTint(s.tint)}
                        onFocus={() => setHoverTint(s.tint)}
                        onBlur={() => setHoverTint(null)}
                    >
                        <span className={styles.spectrumMark} aria-hidden="true" />
                        <span className={styles.spectrumName}>{s.name}</span>
                        <span className={styles.spectrumSummary}>{s.summary}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
