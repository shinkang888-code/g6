import { WwwNav } from "@/components/www/WwwNav";
import { WwwHero } from "@/components/www/WwwHero";
import { WwwTrustBar } from "@/components/www/WwwTrustBar";
import { WwwFeatureSections } from "@/components/www/WwwFeatureSections";
import { WwwModuleGrid } from "@/components/www/WwwModuleGrid";
import { WwwProductTabs } from "@/components/www/WwwProductTabs";
import { WwwAudienceSections } from "@/components/www/WwwAudienceSections";
import { WwwStats } from "@/components/www/WwwStats";
import { WwwTestimonials } from "@/components/www/WwwTestimonials";
import { WwwSecurity } from "@/components/www/WwwSecurity";
import { WwwFaq } from "@/components/www/WwwFaq";
import { WwwCtaBanner } from "@/components/www/WwwCtaBanner";
import { WwwFooter } from "@/components/www/WwwFooter";

export default function WwwHomePage() {
  return (
    <>
      <WwwNav />
      <main>
        <WwwHero />
        <WwwTrustBar />
        <WwwFeatureSections />
        <WwwModuleGrid />
        <WwwProductTabs />
        <WwwAudienceSections />
        <WwwStats />
        <WwwTestimonials />
        <WwwSecurity />
        <WwwFaq />
        <WwwCtaBanner />
      </main>
      <WwwFooter />
    </>
  );
}
