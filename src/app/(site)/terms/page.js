import LegalPage from "@/components/site/LegalPage";
import { TERMS } from "@/content/legal";

export const metadata = {
    title: "Terms of use | Aura Infotech",
    description: "The terms for using the Aura Infotech website.",
};

export default function TermsPage() {
    return <LegalPage doc={TERMS} />;
}
