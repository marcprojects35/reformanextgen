import { SiteNav } from '@/components/landing/site-nav'
import { SmoothScroll } from '@/components/landing/smooth-scroll'
import { ScrollProgress } from '@/components/landing/scroll-progress'
import { Hero } from '@/components/landing/hero'
import { LogoMarquee } from '@/components/landing/logo-marquee'
import { ProblemSection } from '@/components/landing/problem-section'
import { ManifestoSection } from '@/components/landing/manifesto-section'
import { SolutionSection } from '@/components/landing/solution-section'
import { HowItWorks } from '@/components/landing/how-it-works'
import { ImpactSection } from '@/components/landing/impact-section'
import { CasesSection } from '@/components/landing/cases-section'
import { EngagementSection } from '@/components/landing/engagement-section'
import { CtaFooter } from '@/components/landing/cta-footer'

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background">
      <SmoothScroll />
      <ScrollProgress />
      <SiteNav />
      <Hero />
      <LogoMarquee />
      <ProblemSection />
      <ManifestoSection />
      <SolutionSection />
      <HowItWorks />
      <ImpactSection />
      <CasesSection />
      <EngagementSection />
      <CtaFooter />
    </main>
  )
}
