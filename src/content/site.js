// src/content/site.js
// Company-wide details shown in the footer, the Contact page and elsewhere.
//
// Anything in [square brackets] is a placeholder: replace it with the real
// value. An empty string ("") hides that item on the site.

export const SITE = {
    name: "Aura Infotech",
    url: "https://aurainfotech.ca",
    tagline: "Where advanced systems meet real-world impact",
    // One sentence used in the footer and as the default page description
    pitch: "Aura Infotech designs and builds websites, software and brands, then helps them grow.",
};

export const CONTACT = {
    email: "contact@aurainfotech.ca",
    phone: "",              // e.g. "+1 416 555 0123" (empty = hidden)
    whatsapp: "",           // e.g. "https://wa.me/14165550123" (empty = hidden)
    location: "[City, Province]",
    replyTime: "[We reply within one business day.]",
    bookingUrl: "",         // e.g. a Calendly link (empty = the booking block is hidden)
};

// Social profiles (empty url = hidden)
export const SOCIALS = [
    { label: "LinkedIn",  url: "" },
    { label: "Instagram", url: "" },
    { label: "GitHub",    url: "" },
];

// Contact form delivery.
// The site is exported as static files, so submissions go to a form service.
// Paste the endpoint here once you pick one, for example
//   Formspree:  "https://formspree.io/f/xxxxxxxx"
//   Web3Forms:  "https://api.web3forms.com/submit"  (also set FORM_ACCESS_KEY)
// While this is empty, "Send message" opens the visitor's email app with the
// message filled in, so no enquiry is lost.
export const FORM_ENDPOINT = "";
export const FORM_ACCESS_KEY = ""; // Web3Forms only

// Budget and timeline choices on the Contact form
export const BUDGETS = ["Under $5k", "$5k to $15k", "$15k to $50k", "Over $50k", "Not sure yet"];
export const TIMELINES = ["As soon as possible", "Within 1 to 3 months", "In 3 to 6 months", "Just exploring"];
