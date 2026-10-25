import { SiteChrome } from "@/components/site/SiteChrome";

/** Public content pages share the homepage's navigation and footer. URLs are unchanged by the route group. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
