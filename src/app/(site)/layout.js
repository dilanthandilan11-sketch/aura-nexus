// Shared frame for every page except Home: the 3D world stays mounted while
// these pages change, so moving between them flies through the same space.
import SiteShell from "@/components/site/SiteShell";

export default function SiteLayout({ children }) {
    return <SiteShell>{children}</SiteShell>;
}
