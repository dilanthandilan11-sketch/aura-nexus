// src/content/about.js
// Content for the About page. Anything in [square brackets] is a placeholder.

export const ABOUT = {
    heading: "We build the parts of a business people meet online",
    intro:
        "Aura Infotech is a [team of N] designers, developers and marketers. [One or two sentences on who you work with and what makes your approach different.]",

    story: [
        "[How Aura Infotech started: who founded it, when, and why.]",
        "[What the company does today and who for.]",
    ],

    // Moments in the company's story, oldest first
    timeline: [
        { year: "[Year]", text: "[Aura Infotech is founded]" },
        { year: "[Year]", text: "[First client or first big project]" },
        { year: "[Year]", text: "[A milestone: team size, new service, an award]" },
        { year: "[Year]", text: "[Where you are now]" },
    ],

    values: [
        { title: "[Value one]", text: "[What it means in practice, in one or two sentences.]" },
        { title: "[Value two]", text: "[What it means in practice, in one or two sentences.]" },
        { title: "[Value three]", text: "[What it means in practice, in one or two sentences.]" },
    ],

    // How a project runs, in order
    process: [
        { step: "Discover", text: "We learn how your business works, who your customers are and what success looks like." },
        { step: "Design", text: "We shape the solution with you, from structure to the final look, before anything is built." },
        { step: "Build", text: "We build in short cycles and share working versions as we go." },
        { step: "Grow", text: "After launch we measure what's working and keep improving it." },
    ],

    // photo: image path under /public, e.g. "/team/jane.jpg" (empty = initials are shown)
    team: [
        { name: "[Name]", role: "[Role]", photo: "" },
        { name: "[Name]", role: "[Role]", photo: "" },
        { name: "[Name]", role: "[Role]", photo: "" },
    ],
};
