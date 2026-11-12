// src/components/site/ContactForm.jsx
// The project enquiry form on /contact.
//
// With FORM_ENDPOINT set (src/content/site.js) the message is sent to your
// form service. While it is empty, "Send message" opens the visitor's email
// app with everything filled in, so no enquiry is lost.
// Either way, sending plays the "transmit" moment: the 3D world pulls the
// message into the logo.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CONTACT, FORM_ENDPOINT, FORM_ACCESS_KEY, BUDGETS, TIMELINES } from "@/content/site";
import { transmit } from "@/components/world/worldStore";
import styles from "@/components/site/site.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY = { name: "", email: "", company: "", services: [], budget: "", timeline: "", message: "", website: "" };

export default function ContactForm({ services }) {
    const uid = useId();
    const [values, setValues] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState("idle");   // idle | sending | sent | mailto | failed
    const [attempt, setAttempt] = useState(0);       // bumps on every failed submit
    const firstErrorRef = useRef(null);
    const sentRef = useRef(null);

    // /contact?service=web-development pre-selects that service
    useEffect(() => {
        const slug = new URLSearchParams(window.location.search).get("service");
        if (slug && services.some((s) => s.slug === slug)) {
            setValues((v) => (v.services.includes(slug) ? v : { ...v, services: [...v.services, slug] }));
        }
    }, [services]);

    useEffect(() => {
        if (status === "sent" || status === "mailto") sentRef.current?.focus();
    }, [status]);

    // After a failed submit, move focus to the first field that needs fixing
    useEffect(() => {
        if (attempt) firstErrorRef.current?.focus();
    }, [attempt]);

    const set = (key) => (e) => {
        const value = e.target.value;
        setValues((v) => ({ ...v, [key]: value }));
        if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    };

    const toggleService = (slug) => {
        setValues((v) => ({
            ...v,
            services: v.services.includes(slug) ? v.services.filter((s) => s !== slug) : [...v.services, slug],
        }));
    };

    const validate = () => {
        const er = {};
        if (!values.name.trim()) er.name = "Enter your name.";
        if (!values.email.trim()) er.email = "Enter your email address.";
        else if (!EMAIL_RE.test(values.email.trim())) er.email = "Enter an email address like name@company.com.";
        if (values.message.trim().length < 10) er.message = "Tell us a little about the project (at least 10 characters).";
        return er;
    };

    const serviceNames = () =>
        values.services.map((slug) => services.find((s) => s.slug === slug)?.name).filter(Boolean);

    const onSubmit = async (e) => {
        e.preventDefault();
        const er = validate();
        setErrors(er);
        if (Object.keys(er).length) {
            setAttempt((n) => n + 1);
            return;
        }
        // Spam trap: real people never see or fill this field
        if (values.website) { setStatus("sent"); return; }

        const payload = {
            name: values.name.trim(),
            email: values.email.trim(),
            company: values.company.trim(),
            services: serviceNames().join(", "),
            budget: values.budget,
            timeline: values.timeline,
            message: values.message.trim(),
        };

        if (!FORM_ENDPOINT) {
            // No form service yet: hand the message to the visitor's email app
            const body = [
                `Name: ${payload.name}`,
                `Email: ${payload.email}`,
                payload.company && `Company: ${payload.company}`,
                payload.services && `Services: ${payload.services}`,
                payload.budget && `Budget: ${payload.budget}`,
                payload.timeline && `Timeline: ${payload.timeline}`,
                "",
                payload.message,
            ].filter((l) => l !== false && l !== "").join("\n");
            transmit();
            window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(`Project enquiry from ${payload.name}`)}&body=${encodeURIComponent(body)}`;
            setStatus("mailto");
            return;
        }

        setStatus("sending");
        try {
            const res = await fetch(FORM_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    ...payload,
                    subject: `Project enquiry from ${payload.name}`,
                    ...(FORM_ACCESS_KEY ? { access_key: FORM_ACCESS_KEY } : {}),
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            transmit();
            // Let the transmit moment play before the confirmation replaces the form
            setTimeout(() => setStatus("sent"), 900);
        } catch {
            setStatus("failed");
        }
    };

    const reset = () => { setValues(EMPTY); setErrors({}); setStatus("idle"); };

    if (status === "sent" || status === "mailto") {
        return (
            <div className={styles.sent} role="status">
                <h2 tabIndex={-1} ref={sentRef}>{status === "sent" ? "Message sent" : "Your email is ready to send"}</h2>
                <p className={styles.muted}>
                    {status === "sent"
                        ? `Thanks, ${values.name.trim() || "we've got it"}. We'll reply to ${values.email.trim() || "you"} soon.`
                        : `Your email app opened with the message filled in. Send it from there and we'll reply to ${values.email.trim()}. If nothing opened, write to ${CONTACT.email}.`}
                </p>
                <div className={styles.actions}>
                    <button type="button" className={styles.buttonGhost} onClick={reset}>Write another message</button>
                </div>
            </div>
        );
    }

    const firstError = ["name", "email", "message"].find((k) => errors[k]);
    const errRef = (key) => (key === firstError ? firstErrorRef : undefined);
    const id = (k) => `${uid}-${k}`;

    return (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
            <div className={styles.formRow}>
                <div className={styles.field}>
                    <label htmlFor={id("name")} className={styles.label}>Your name</label>
                    <input
                        id={id("name")} ref={errRef("name")} className={styles.input} autoComplete="name"
                        value={values.name} onChange={set("name")}
                        aria-invalid={errors.name ? "true" : undefined}
                        aria-describedby={errors.name ? id("name-error") : undefined}
                    />
                    {errors.name && <p id={id("name-error")} className={styles.error}>{errors.name}</p>}
                </div>
                <div className={styles.field}>
                    <label htmlFor={id("email")} className={styles.label}>Email</label>
                    <input
                        id={id("email")} ref={errRef("email")} className={styles.input} type="email" autoComplete="email"
                        value={values.email} onChange={set("email")}
                        aria-invalid={errors.email ? "true" : undefined}
                        aria-describedby={errors.email ? id("email-error") : undefined}
                    />
                    {errors.email && <p id={id("email-error")} className={styles.error}>{errors.email}</p>}
                </div>
            </div>

            <div className={styles.field}>
                <label htmlFor={id("company")} className={styles.label}>Company <span className={styles.optional}>(optional)</span></label>
                <input id={id("company")} className={styles.input} autoComplete="organization" value={values.company} onChange={set("company")} />
            </div>

            <fieldset className={styles.choices}>
                <legend className={styles.label}>What do you need? <span className={styles.optional}>(pick any)</span></legend>
                <div className={styles.choicesList}>
                    {services.map((s) => (
                        <label key={s.slug} className={styles.choice}>
                            <input type="checkbox" checked={values.services.includes(s.slug)} onChange={() => toggleService(s.slug)} />
                            <span>{s.name}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className={styles.formRow}>
                <div className={styles.field}>
                    <label htmlFor={id("budget")} className={styles.label}>Budget <span className={styles.optional}>(optional)</span></label>
                    <select id={id("budget")} className={styles.select} value={values.budget} onChange={set("budget")}>
                        <option value="">Choose a range</option>
                        {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div className={styles.field}>
                    <label htmlFor={id("timeline")} className={styles.label}>Timeline <span className={styles.optional}>(optional)</span></label>
                    <select id={id("timeline")} className={styles.select} value={values.timeline} onChange={set("timeline")}>
                        <option value="">Choose a timeline</option>
                        {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <div className={styles.field}>
                <label htmlFor={id("message")} className={styles.label}>About the project</label>
                <textarea
                    id={id("message")} ref={errRef("message")} className={styles.textarea}
                    value={values.message} onChange={set("message")}
                    placeholder="What are you building, and what would make it a success?"
                    aria-invalid={errors.message ? "true" : undefined}
                    aria-describedby={errors.message ? id("message-error") : undefined}
                />
                {errors.message && <p id={id("message-error")} className={styles.error}>{errors.message}</p>}
            </div>

            {/* Spam trap, hidden from people and screen readers */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor={id("website")}>Website</label>
                <input id={id("website")} tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
            </div>

            {status === "failed" && (
                <p className={styles.formError} role="alert">
                    The message didn't send. Check your connection and try again, or email us at{" "}
                    <a href={`mailto:${CONTACT.email}`} className={styles.textLink}>{CONTACT.email}</a>.
                </p>
            )}

            <div>
                <button type="submit" className={styles.buttonPrimary} disabled={status === "sending"}>
                    {status === "sending" ? "Sending message" : "Send message"}
                </button>
            </div>
        </form>
    );
}
