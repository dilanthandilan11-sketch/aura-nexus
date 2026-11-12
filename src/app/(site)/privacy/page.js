import LegalPage from "@/components/site/LegalPage";
import { PRIVACY } from "@/content/legal";

export const metadata = {
    title: "Privacy policy | Aura Infotech",
    description: "How Aura Infotech handles personal information.",
};

export default function PrivacyPage() {
    return <LegalPage doc={PRIVACY} />;
}
