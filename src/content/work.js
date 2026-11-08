// src/content/work.js
// Projects shown on /work and on their own case-study pages /work/<slug>.
//
// These three are placeholders so the pages can be built and reviewed.
// Replace them with real projects (or delete them) before launch.
// services: slugs from src/content/services.js
// cover / gallery: image paths under /public, e.g. "/work/project-one/cover.jpg"
//                  (leave empty and a neutral frame is shown instead)

export const PROJECTS = [
    {
        slug: "project-one",
        name: "Project One",
        client: "[Client name]",
        industry: "[Industry]",
        year: "[Year]",
        services: ["web-development", "ui-ux-designing"],
        liveUrl: "",
        summary: "[One sentence on what was built and for whom.]",
        result: "[One result you can stand behind, e.g. \"Enquiries doubled in three months\"]",
        challenge:
            "[What the client was struggling with before the project, in two or three sentences.]",
        approach: [
            { title: "[First thing we did]", detail: "[What it involved and why.]" },
            { title: "[Second thing we did]", detail: "[What it involved and why.]" },
            { title: "[Third thing we did]", detail: "[What it involved and why.]" },
        ],
        results: [
            { value: "[Number]", label: "[What it measures]" },
            { value: "[Number]", label: "[What it measures]" },
            { value: "[Number]", label: "[What it measures]" },
        ],
        cover: "",
        gallery: [],
    },
    {
        slug: "project-two",
        name: "Project Two",
        client: "[Client name]",
        industry: "[Industry]",
        year: "[Year]",
        services: ["software-development", "analytics-data-analysis"],
        liveUrl: "",
        summary: "[One sentence on what was built and for whom.]",
        result: "[One result you can stand behind]",
        challenge:
            "[What the client was struggling with before the project, in two or three sentences.]",
        approach: [
            { title: "[First thing we did]", detail: "[What it involved and why.]" },
            { title: "[Second thing we did]", detail: "[What it involved and why.]" },
        ],
        results: [
            { value: "[Number]", label: "[What it measures]" },
            { value: "[Number]", label: "[What it measures]" },
        ],
        cover: "",
        gallery: [],
    },
    {
        slug: "project-three",
        name: "Project Three",
        client: "[Client name]",
        industry: "[Industry]",
        year: "[Year]",
        services: ["graphic-designing", "digital-marketing", "seo"],
        liveUrl: "",
        summary: "[One sentence on what was built and for whom.]",
        result: "[One result you can stand behind]",
        challenge:
            "[What the client was struggling with before the project, in two or three sentences.]",
        approach: [
            { title: "[First thing we did]", detail: "[What it involved and why.]" },
            { title: "[Second thing we did]", detail: "[What it involved and why.]" },
            { title: "[Third thing we did]", detail: "[What it involved and why.]" },
        ],
        results: [
            { value: "[Number]", label: "[What it measures]" },
            { value: "[Number]", label: "[What it measures]" },
            { value: "[Number]", label: "[What it measures]" },
        ],
        cover: "",
        gallery: [],
    },
];

export const getProject = (slug) => PROJECTS.find((p) => p.slug === slug) ?? null;
