/**
 * Public landing page. Buyers use the Android app; this page explains SaathMein and
 * points dealers to the dealer dashboard.
 */
import { ShieldCheck, Store, Wallet } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import FadeIn from '@/components/animations/FadeIn';
import Button from '@/components/ui/Button';
import GroupPreviewCard from '@/components/features/GroupPreviewCard';
import HowItWorks from '@/components/features/HowItWorks';
import { ROUTES } from '@/utils/constants';

const DEALER_POINTS = [
  {
    icon: Store,
    title: 'Bulk orders, ready buyers',
    body: 'Every member has paid a token. You bid for the whole group at once, not one walk-in at a time.',
  },
  {
    icon: ShieldCheck,
    title: 'Fair, anonymous auctions',
    body: 'You see the lowest price and your rank, never other dealers. All-inclusive prices mean no hidden-charge games.',
  },
  {
    icon: Wallet,
    title: 'Paid through Razorpay',
    body: 'Tokens move to your linked account when each purchase is confirmed, minus a small commission.',
  },
];

/**
 * @returns {JSX.Element}
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20 lg:gap-16">
          <div className="animate-rise">
            <p className="inline-flex items-center rounded-full border border-line bg-bg-band px-3 py-1 text-xs font-semibold text-muted">
              Group buying, starting in Pune
            </p>
            <h1 className="mt-5 text-[clamp(2.25rem,7vw,4rem)] font-extrabold leading-[1.05] tracking-tight text-ink">
              Buy together.
              <br />
              <span className="text-sunrise">Save together.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[clamp(1rem,2.4vw,1.125rem)] leading-relaxed text-muted">
              People who want the same car, bike or phone join one group. Verified dealers bid for
              the whole group, and the lowest price wins for everyone.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="#how-it-works" size="lg">
                See how it works
              </Button>
              <Button href="#dealers" variant="secondary" size="lg">
                I am a dealer
              </Button>
            </div>
          </div>

          <div className="animate-rise [animation-delay:100ms]">
            <GroupPreviewCard />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 bg-bg-band py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <FadeIn>
              <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold tracking-tight text-ink">
                How SaathMein works
              </h2>
              <p className="mt-3 max-w-2xl text-muted">
                When one person walks into a showroom, they get a small discount. When twenty walk
                in together, the dealer finds a much bigger one.
              </p>
            </FadeIn>
            <div className="mt-10">
              <HowItWorks />
            </div>
          </div>
        </section>

        {/* Dealers */}
        <section id="dealers" className="scroll-mt-20 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <FadeIn>
              <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold tracking-tight text-ink">
                For dealers and shops
              </h2>
              <p className="mt-3 max-w-2xl text-muted">
                Give us your best price for a full group of confirmed buyers. Register your
                business, finish KYC once, and bid on group orders in Pune.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button href={ROUTES.SELLER_REGISTER} size="lg">
                  <Store className="size-5" strokeWidth={2} aria-hidden="true" />
                  Register your business
                </Button>
                <Button href={ROUTES.SELLER_LOGIN} variant="secondary" size="lg">
                  Dealer login
                </Button>
              </div>
            </FadeIn>

            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
              {DEALER_POINTS.map(({ icon: Icon, title, body }, index) => (
                <FadeIn as="li" key={title} delay={index * 0.06} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-button bg-bg-band text-primary">
                    <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-bold text-ink">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                  </div>
                </FadeIn>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
