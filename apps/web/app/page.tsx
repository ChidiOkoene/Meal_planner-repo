import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

const steps = [
  {
    title: 'You tell us about your parent',
    body: 'Their health needs, the food they love, and a weekly budget. A dietitian sets safe limits with them.',
  },
  {
    title: 'A plan for the week',
    body: 'Familiar Nigerian dishes in the right portions, approved by the dietitian and sent to your parent on WhatsApp.',
  },
  {
    title: 'Food delivered',
    body: 'A trusted local vendor buys and delivers the ingredients. You get a photo when it arrives.',
  },
  {
    title: 'You stay in the loop',
    body: 'Check-ins with your parent each week, and a monthly report on how they are doing.',
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
            Healthy home cooking for your parent, wherever you are.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-text-muted">
            Weekly meal plans for parents in Lagos living with diabetes or high blood pressure. Real
            Nigerian food, portioned by a dietitian, delivered by people you can trust.
          </p>
          <p className="mt-8 inline-block rounded-md bg-surface-muted px-4 py-2 text-sm text-text-muted">
            Launching soon in Lagos for families in the UK.
          </p>
        </section>

        <section aria-labelledby="how-it-works" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 id="how-it-works" className="text-2xl font-semibold">
              How it works
            </h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-lg border border-border bg-bg p-5">
                  <span className="text-sm font-semibold text-brand">Step {index + 1}</span>
                  <h3 className="mt-2 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10 text-sm text-text-muted">
          <p>
            Dyjext Care supports healthy eating. It does not replace medical advice; always follow
            your doctor&apos;s guidance.
          </p>
          <p className="mt-4">
            <Link href="/ops" className="underline hover:text-brand">
              Staff console
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
