import type { Metadata } from 'next';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingStats } from '@/components/landing/LandingStats';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingPlans } from '@/components/landing/LandingPlans';
import { PanelPreview } from '@/components/landing/PanelPreview';
import { LandingRewards } from '@/components/landing/LandingRewards';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { fetchSeoByPath, toNextMetadata } from '@/lib/seo';

const fallbackMetadata: Metadata = {
  title: 'AstraNodes — Game Server Hosting',
  description: 'Deploy powerful Minecraft servers instantly with enterprise infrastructure and gamer-friendly pricing.',
};

export async function generateMetadata(): Promise<Metadata> {
  const seo = await fetchSeoByPath('/');
  return toNextMetadata(seo, fallbackMetadata);
}

export default async function LandingPage() {
  return (
    <>
      <PublicNav />
      <main>
        <LandingHero />
        <LandingStats />
        <LandingFeatures />
        <LandingPlans />
        <PanelPreview />
        <LandingRewards />
      </main>
      <Footer />
    </>
  );
}
