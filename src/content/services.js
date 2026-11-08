// src/content/services.js
// The seven services. Each one gets its own page at /services/<slug>,
// generated from this file.
//
// tint: the colour the logo's marble turns on that service, and the colour of
//       its mark in the services list.
// Wording here is a first draft written from the existing site copy; anything
// in [square brackets] still needs your real details.

export const SERVICES = [
    {
        slug: "software-development",
        name: "Software Development",
        tint: "#1CE3DA",
        summary: "Platforms, internal tools and APIs built to carry next year's load.",
        promise: "Software your team can run and grow long after we hand it over.",
        intro:
            "We design the architecture, build the backend and the interfaces, and document it so your own team can maintain it. Every project starts with how your business actually works, not with a framework.",
        deliverables: [
            "Custom web applications and business platforms",
            "APIs and integrations with the tools you already use",
            "Cloud setup, deployment and monitoring",
            "Documentation and a handover session for your team",
        ],
        process: [
            { step: "Scope", detail: "We map the workflows the software has to support and agree on the first release." },
            { step: "Architecture", detail: "Data model, services and hosting are planned before any code is written." },
            { step: "Build", detail: "Short cycles with a working version you can try every [two weeks]." },
            { step: "Launch and handover", detail: "We deploy, monitor the first weeks and train your team." },
        ],
        tools: ["[Node.js]", "[Next.js]", "[PostgreSQL]", "[AWS or Azure]", "[Docker]"],
        faqs: [
            { q: "How long does a typical project take?", a: "[Add a typical range, for example 6 to 12 weeks for a first release.]" },
            { q: "Do we own the code?", a: "[Explain code ownership and licensing.]" },
            { q: "Can you work with our existing system?", a: "[Explain how you handle existing codebases.]" },
        ],
    },
    {
        slug: "web-development",
        name: "Web Development",
        tint: "#3FB8FF",
        summary: "Fast websites built around one clear goal per page.",
        promise: "A website that loads fast, reads clearly and turns visits into enquiries.",
        intro:
            "Leads, sign-ups or sales: every page is built around the one thing it should get a visitor to do, and tuned to load quickly on every device.",
        deliverables: [
            "Marketing websites and landing pages",
            "Content management so you can edit pages yourself",
            "Performance and accessibility tuning",
            "Analytics set up from day one",
        ],
        process: [
            { step: "Goals", detail: "We agree on what each page has to achieve and how we'll measure it." },
            { step: "Design", detail: "Layouts for desktop and phone, reviewed with real content." },
            { step: "Build", detail: "Development on a private preview link you can check at any time." },
            { step: "Launch", detail: "Go live, redirects and search setup, then a check-in after [30 days]." },
        ],
        tools: ["[Next.js]", "[React]", "[WordPress]", "[Shopify]", "[Vercel]"],
        faqs: [
            { q: "Can we update the site ourselves?", a: "[Explain the editing setup you provide.]" },
            { q: "Do you handle hosting?", a: "[Explain hosting options and costs.]" },
            { q: "What does a website cost?", a: "[Add a typical price range or how you quote.]" },
        ],
    },
    {
        slug: "digital-marketing",
        name: "Digital Marketing",
        tint: "#12E39B",
        summary: "Campaigns measured against revenue, not likes.",
        promise: "Marketing where every campaign feeds the next one.",
        intro:
            "Strategy, content and paid campaigns planned together, tracked against real results, and adjusted every month based on what the numbers say.",
        deliverables: [
            "Marketing strategy and channel plan",
            "Paid campaigns on search and social",
            "Content and social media calendars",
            "Monthly reports in plain language",
        ],
        process: [
            { step: "Audit", detail: "Where your customers come from today and what each channel costs." },
            { step: "Plan", detail: "Channels, budget split and the numbers we'll be judged on." },
            { step: "Run", detail: "Campaigns go live and are adjusted every [week]." },
            { step: "Report", detail: "A monthly review of results and the next month's changes." },
        ],
        tools: ["[Google Ads]", "[Meta Ads]", "[Google Analytics]", "[Mailchimp]"],
        faqs: [
            { q: "What budget do we need?", a: "[Add a minimum or typical ad budget.]" },
            { q: "How soon will we see results?", a: "[Set expectations for paid versus organic results.]" },
            { q: "Do we keep our ad accounts?", a: "[Explain account ownership.]" },
        ],
    },
    {
        slug: "graphic-designing",
        name: "Graphic Designing",
        tint: "#B84DFF",
        summary: "Brand identities and graphics that look like nobody else.",
        promise: "A visual identity defined once and recognisable everywhere it appears.",
        intro:
            "Logo, colour, type and imagery shaped into one system, with ready-to-use files for print, web and social so every piece looks like it came from the same place.",
        deliverables: [
            "Logo and brand identity",
            "Brand guidelines",
            "Social media and marketing graphics",
            "Print materials: cards, flyers, signage",
        ],
        process: [
            { step: "Brief", detail: "Who you are, who you're for and what you want people to feel." },
            { step: "Concepts", detail: "[Two or three] distinct directions to choose from." },
            { step: "Refine", detail: "The chosen direction developed across real examples." },
            { step: "Deliver", detail: "Final files and a short guide on using them." },
        ],
        tools: ["[Adobe Illustrator]", "[Photoshop]", "[Figma]", "[After Effects]"],
        faqs: [
            { q: "How many revisions are included?", a: "[Add your revision policy.]" },
            { q: "What files do we get?", a: "[List the file formats you deliver.]" },
            { q: "Can you refresh an existing brand?", a: "[Explain how you approach rebrands.]" },
        ],
    },
    {
        slug: "ui-ux-designing",
        name: "UI/UX Designing",
        tint: "#E255C8",
        summary: "Interfaces people understand on the first try.",
        promise: "Products that feel obvious to use, because they were tested before they were built.",
        intro:
            "We research how your users work, design the flows and screens, and test them with real people before a line of code is written.",
        deliverables: [
            "User research and interviews",
            "User flows and wireframes",
            "Interface design and a design system",
            "Clickable prototypes for testing",
        ],
        process: [
            { step: "Research", detail: "Interviews and a look at how people use what you have today." },
            { step: "Flows", detail: "The paths people take, sketched and agreed before any visuals." },
            { step: "Design", detail: "Screens and components in a shared design file." },
            { step: "Test", detail: "Prototype sessions with users, then changes based on what we see." },
        ],
        tools: ["[Figma]", "[FigJam]", "[Maze]", "[Hotjar]"],
        faqs: [
            { q: "Do you also build what you design?", a: "Yes. Our development team can build it, or we hand over files your developers can work from." },
            { q: "How do you test designs?", a: "[Explain your testing approach.]" },
            { q: "Can you improve an existing app?", a: "[Explain how you approach redesigns.]" },
        ],
    },
    {
        slug: "seo",
        name: "SEO",
        tint: "#4D7CFF",
        summary: "Get found by the people already searching for you.",
        promise: "Search traffic that keeps arriving without paying for every click.",
        intro:
            "Technical fixes, content and local search worked on together, with rankings and enquiries tracked so you can see what the work is bringing in.",
        deliverables: [
            "Technical SEO audit and fixes",
            "Keyword research and content plan",
            "On-page optimisation",
            "Local search and Google Business Profile",
        ],
        process: [
            { step: "Audit", detail: "Technical health, current rankings and what competitors rank for." },
            { step: "Fix", detail: "The technical problems holding the site back, highest impact first." },
            { step: "Content", detail: "Pages and articles planned around what people actually search." },
            { step: "Track", detail: "Monthly ranking and traffic reports." },
        ],
        tools: ["[Google Search Console]", "[Ahrefs]", "[Screaming Frog]", "[Google Analytics]"],
        faqs: [
            { q: "How long does SEO take to work?", a: "[Set expectations, for example first movement in 3 to 6 months.]" },
            { q: "Do you guarantee rankings?", a: "[Explain your position on guarantees.]" },
            { q: "Is SEO a one-off or ongoing?", a: "[Explain your engagement options.]" },
        ],
    },
    {
        slug: "analytics-data-analysis",
        name: "Analytics & Data Analysis",
        tint: "#FFB547",
        summary: "Turn the data you already collect into decisions.",
        promise: "Dashboards and analysis that answer the questions you actually ask.",
        intro:
            "We connect your data sources, clean them up and build reports and dashboards that show what's working, so decisions don't wait for someone to pull numbers.",
        deliverables: [
            "Tracking and analytics setup",
            "Dashboards for sales, marketing or operations",
            "Data cleaning and integration",
            "One-off analysis and recommendations",
        ],
        process: [
            { step: "Questions", detail: "The decisions you need data for, written down first." },
            { step: "Connect", detail: "Your sources linked and checked for gaps or errors." },
            { step: "Build", detail: "Reports and dashboards, tested with the people who'll use them." },
            { step: "Review", detail: "A walkthrough of findings and what to act on." },
        ],
        tools: ["[Google Analytics]", "[Looker Studio]", "[Power BI]", "[Python]", "[SQL]"],
        faqs: [
            { q: "What data do you need from us?", a: "[Explain access and data needed.]" },
            { q: "Is our data kept private?", a: "[Explain how you handle client data.]" },
            { q: "Can you train our team on the dashboards?", a: "[Explain training options.]" },
        ],
    },
];

export const getService = (slug) => SERVICES.find((s) => s.slug === slug) ?? null;
