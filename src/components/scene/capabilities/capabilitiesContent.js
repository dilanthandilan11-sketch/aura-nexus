// Capabilities section content + per-step particle colours.
// Index matches the steps and the shapes in shapes.js:
// 0 intro (Aura logo), 1 Build, 2 Grow, 3 Create, 4 Optimize, 5 Sell.

export const INTRO = {
  eyebrow: "Aura Infotech / Capabilities",
  heading: "We turn ambitious ideas into digital experiences.",
  body: "We combine technology, design, and strategy to help businesses build, grow, and stand out in a digital-first world.",
  tags: ["01 / Engineering", "02 / Creative", "03 / Growth"],
};

export const SERVICES = [
  {
    number: "01",
    verb: "Build",
    title: "Software & Web Development",
    body: "Custom websites, web applications, business platforms, and tailored software solutions. Explore scalable architecture, modern front-end experiences, and backend systems.",
  },
  {
    number: "02",
    verb: "Grow",
    title: "Digital Marketing",
    body: "Help brands reach the right audience through SEO, digital campaigns, and data-informed marketing strategies.",
  },
  {
    number: "03",
    verb: "Create",
    title: "Graphic Design & UI/UX",
    body: "Brand identities, digital graphics, intuitive interfaces, and visually distinctive user experiences.",
  },
  {
    number: "04",
    verb: "Optimize",
    title: "IT & Data Services",
    body: "Data analysis, technology integration, and digital infrastructure solutions that support smarter operations.",
  },
  {
    number: "05",
    verb: "Sell",
    title: "E-commerce Management",
    // TODO: copy to be supplied. Left empty so no placeholder text ships;
    // the step shows the verb and title until this is filled in.
    body: "",
  },
];

// Particle colours per step: [bottom, middle, top] of the vertical gradient.
// Step 0 keeps the void-ending logo palette (teal -> cyan -> violet) so the
// hand-off has no colour jump; the services use one accent each, lightly
// shaded so the shapes keep depth.
export const STEP_COLORS = [
  ["#12e3b0", "#3fb8ff", "#8a3cff"], // Intro: teal -> violet
  ["#2a8fd6", "#3fb8ff", "#9bdcff"], // Build: cyan
  ["#0fb98f", "#12e3b0", "#7af5d4"], // Grow: teal-green
  ["#9437d6", "#b84dff", "#e391ff"], // Create: violet / pink
  ["#3a5fd0", "#4d7cff", "#a3b8ff"], // Optimize: blue
  ["#e0902a", "#ffb547", "#ffdba0"], // Sell: amber
];
