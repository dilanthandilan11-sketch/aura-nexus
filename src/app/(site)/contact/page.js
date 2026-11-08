import Station from "@/components/world/Station";
import ContactForm from "@/components/site/ContactForm";
import { CONTACT, SOCIALS } from "@/content/site";
import { SERVICES } from "@/content/services";
import styles from "@/components/site/site.module.css";

export const metadata = {
    title: "Contact | Aura Infotech",
    description: "Tell Aura Infotech about your project.",
};

export default function ContactPage() {
    const socials = SOCIALS.filter((s) => s.url);
    return (
        <main className={styles.flip}>
            <Station name="contact" />
            <div className={styles.wrap}>
                <header className={`${styles.hero} ${styles.column}`}>
                    <h1 className={styles.title}>Tell us what you're building</h1>
                    <p className={styles.lead}>{CONTACT.replyTime}</p>
                </header>

                <section className={styles.section} aria-label="Project enquiry form">
                    <ContactForm services={SERVICES.map(({ slug, name }) => ({ slug, name }))} />
                </section>

                <section className={styles.section} aria-labelledby="other-title">
                    <div className={styles.column}>
                        <h2 id="other-title" className={styles.sectionTitle}>Other ways to reach us</h2>
                        <dl className={styles.contactList}>
                            <div>
                                <dt className={styles.contactKey}>Email</dt>
                                <dd className={styles.contactValue}><a href={`mailto:${CONTACT.email}`} className={styles.textLink}>{CONTACT.email}</a></dd>
                            </div>
                            {CONTACT.phone ? (
                                <div>
                                    <dt className={styles.contactKey}>Phone</dt>
                                    <dd className={styles.contactValue}><a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className={styles.textLink}>{CONTACT.phone}</a></dd>
                                </div>
                            ) : null}
                            {CONTACT.whatsapp ? (
                                <div>
                                    <dt className={styles.contactKey}>WhatsApp</dt>
                                    <dd className={styles.contactValue}><a href={CONTACT.whatsapp} className={styles.textLink} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a></dd>
                                </div>
                            ) : null}
                            {CONTACT.location ? (
                                <div>
                                    <dt className={styles.contactKey}>Based in</dt>
                                    <dd className={styles.contactValue}>{CONTACT.location}</dd>
                                </div>
                            ) : null}
                            {CONTACT.bookingUrl ? (
                                <div>
                                    <dt className={styles.contactKey}>Prefer to talk?</dt>
                                    <dd className={styles.contactValue}><a href={CONTACT.bookingUrl} className={styles.textLink} target="_blank" rel="noopener noreferrer">Book a call</a></dd>
                                </div>
                            ) : null}
                            {socials.length > 0 ? (
                                <div>
                                    <dt className={styles.contactKey}>Elsewhere</dt>
                                    <dd className={styles.contactValue}>
                                        {socials.map((s, i) => (
                                            <span key={s.label}>
                                                {i > 0 ? ", " : ""}
                                                <a href={s.url} className={styles.textLink} target="_blank" rel="noopener noreferrer">{s.label}</a>
                                            </span>
                                        ))}
                                    </dd>
                                </div>
                            ) : null}
                        </dl>
                    </div>
                </section>
            </div>
        </main>
    );
}
