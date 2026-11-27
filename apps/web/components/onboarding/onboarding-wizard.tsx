'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_TIMEZONES, type RecipientCountry, WEEKLY_FOOD_BUDGET_NAIRA } from '@dyjext/shared';
import Link from 'next/link';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { type Me, useApi } from '@/lib/api';
import {
  canHaveFullCare,
  COUNTRY_NAMES,
  CURRENCIES,
  type Draft,
  effectiveTier,
  emptyDraft,
  type Errors,
  guessCurrency,
  householdPayload,
  LANGUAGES,
  parseNaira,
  personWords,
  recipientPayload,
  resumeStep,
  type StepId,
  stepsFor,
  suggestedHouseholdName,
  TIMEZONE_CHOICES,
  validateStep,
} from '@/lib/onboarding';
import { ChoiceCards, SelectField, TextField } from './fields';

/** Saved in this browser so leaving mid-way and coming back resumes at the same step. */
interface Saved {
  draft: Draft;
  step: StepId;
  /** Set once the household exists, so a retry after an error doesn't create a second one. */
  householdId?: string;
}

const storageKey = (userId: string) => `dyjext.onboarding.v1.${userId}`;

function load(userId: string): Saved | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(userId: string, value: Saved | null) {
  try {
    if (value) window.localStorage.setItem(storageKey(userId), JSON.stringify(value));
    else window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Private browsing or storage full: the wizard still works, it just won't resume.
  }
}

const stepTitle = (step: StepId, self: boolean): string =>
  ({
    who: 'Who is this for?',
    person: self ? 'About you' : 'About them',
    where: self ? 'Where you live' : 'Where they live',
    budget: 'Weekly food budget',
    payment: 'How you’ll pay',
    review: 'Check and send',
  })[step];

export function OnboardingWizard() {
  const api = useApi();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/v1/me') });

  if (me.isPending) return <p className="text-text-muted">Loading…</p>;
  if (me.isError) {
    return (
      <p role="alert" className="text-bad">
        Could not load your account: {me.error.message}
      </p>
    );
  }
  return <Wizard me={me.data} />;
}

function Wizard({ me }: { me: Me }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<Saved>(() => {
    const restored = load(me.id);
    if (restored) return { ...restored, step: resumeStep(restored.draft, restored.step) };
    return {
      draft: { ...emptyDraft(), billingCurrency: guessCurrency(navigator.language) },
      step: 'who',
    };
  });
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState<{ name: string; self: boolean } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const { draft, step } = saved;
  const steps = stepsFor(draft);
  const index = steps.indexOf(step);
  const words = personWords(draft);
  const alreadySelf = Boolean(me.selfRecipient);

  useEffect(() => {
    if (!done) save(me.id, saved);
  }, [me.id, saved, done]);

  // Move focus to the new step's heading, so screen readers announce it.
  useEffect(() => headingRef.current?.focus(), [step, done]);

  const update = (changes: Partial<Draft>) => {
    setSaved((s) => ({ ...s, draft: { ...s.draft, ...changes } }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(changes)) delete next[key];
      return next;
    });
  };
  const goTo = (next: StepId) => {
    setErrors({});
    setSaved((s) => ({ ...s, step: next }));
  };

  const submit = useMutation({
    mutationFn: async () => {
      let householdId = saved.householdId;
      if (!householdId) {
        const household = await api<{ id: string }>('/v1/households', {
          method: 'POST',
          body: JSON.stringify(householdPayload(draft)),
        });
        householdId = household.id;
        setSaved((s) => ({ ...s, householdId }));
      }
      await api(`/v1/households/${householdId}/recipients`, {
        method: 'POST',
        body: JSON.stringify(recipientPayload(draft)),
      });
    },
    onSuccess: async () => {
      save(me.id, null);
      setDone({ name: draft.displayName.trim(), self: words.self });
      await queryClient.invalidateQueries();
    },
  });

  function next(event: FormEvent) {
    event.preventDefault();
    const problems = validateStep(step, draft);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    if (step === 'review') {
      submit.mutate();
      return;
    }
    const following = steps[index + 1];
    if (following === 'review' && !draft.householdName) {
      update({ householdName: suggestedHouseholdName(draft) });
    }
    if (following) goTo(following);
  }

  if (done) {
    return (
      <section
        aria-labelledby="done-heading"
        className="max-w-xl rounded-lg border border-ok bg-ok-bg p-5"
      >
        <h2 id="done-heading" ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
          {done.self ? 'You’re all set' : `${done.name} has been added`}
        </h2>
        <p className="mt-2">
          {done.self
            ? 'We’ll send you a WhatsApp message to confirm your number and ask you to agree. Reply YES and a dietitian will be in touch to set up your plan.'
            : `We’ll send ${done.name} a WhatsApp message asking them to agree. Nothing starts until they reply YES; then a dietitian will call them to set up their plan.`}
        </p>
        <Link
          href="/app"
          className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast"
        >
          Go to your family page
        </Link>
      </section>
    );
  }

  return (
    <form onSubmit={next} noValidate className="max-w-2xl">
      <p className="text-sm text-text-muted">
        Step {index + 1} of {steps.length}
      </p>
      <ol aria-hidden className="mt-2 flex gap-1">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-brand' : 'bg-border'}`}
          />
        ))}
      </ol>
      <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-xl font-semibold outline-none">
        {stepTitle(step, words.self)}
      </h2>

      <div className="mt-4 space-y-5">
        {step === 'who' ? (
          <ChoiceCards
            legend="The weekly meal plan is for"
            name="relationship"
            value={draft.relationship}
            error={errors.relationship}
            onChange={(relationship) =>
              update({
                relationship,
                // Prefill your own name when the plan is for you.
                ...(relationship === 'self' && !draft.displayName
                  ? { displayName: me.displayName }
                  : {}),
              })
            }
            options={[
              ...(alreadySelf
                ? []
                : [
                    {
                      value: 'self' as const,
                      title: 'Me',
                      description: 'I live with diabetes or high blood pressure.',
                    },
                  ]),
              { value: 'parent' as const, title: 'A parent', description: 'My mum or dad.' },
              {
                value: 'relative' as const,
                title: 'Another relative',
                description: 'An aunty, uncle, sibling or grandparent.',
              },
              {
                value: 'other' as const,
                title: 'A friend or someone else',
                description: 'Someone I look after.',
              },
            ]}
          />
        ) : null}

        {step === 'person' ? (
          <>
            <TextField
              label={words.self ? 'Your name' : 'Their name'}
              hint={
                words.self
                  ? undefined
                  : 'What they’ll be called in messages, e.g. “Mama” or “Uncle Femi”.'
              }
              value={draft.displayName}
              onChange={(displayName) => update({ displayName })}
              error={errors.displayName}
              autoComplete={words.self ? 'name' : 'off'}
            />
            <SelectField<RecipientCountry>
              label={words.self ? 'Country you live in' : 'Country they live in'}
              value={draft.countryCode ?? ''}
              options={Object.entries(COUNTRY_NAMES) as [RecipientCountry, string][]}
              onChange={(countryCode) => update({ countryCode, timezone: '' })}
              error={errors.countryCode}
            />
            <TextField
              label={words.self ? 'Your WhatsApp number' : 'Their WhatsApp number'}
              hint="The plan and check-ins arrive on WhatsApp. Local or international format."
              type="tel"
              inputMode="tel"
              autoComplete={words.self ? 'tel' : 'off'}
              placeholder={draft.countryCode === 'NG' ? '0803 123 4567' : '+44 7911 123456'}
              value={draft.phone}
              onChange={(phone) => update({ phone })}
              error={errors.phone}
            />
            {draft.countryCode && !DEFAULT_TIMEZONES[draft.countryCode] ? (
              <SelectField
                label="Time zone"
                value={draft.timezone}
                options={TIMEZONE_CHOICES[draft.countryCode] ?? []}
                onChange={(timezone) => update({ timezone })}
                error={errors.timezone}
              />
            ) : null}
            <SelectField
              label="Language for messages"
              value={draft.language}
              options={LANGUAGES}
              onChange={(language) => update({ language })}
            />
          </>
        ) : null}

        {step === 'where' ? <WhereStep draft={draft} update={update} errors={errors} /> : null}

        {step === 'budget' ? (
          <>
            <p>
              A local vendor buys the ingredients each week. This is the most they may spend on
              food; the actual amount is confirmed with a photo of the receipt.
            </p>
            <TextField
              label="Weekly food budget (₦)"
              hint={`Most families choose ₦30,000–₦60,000. Between ₦${WEEKLY_FOOD_BUDGET_NAIRA.min.toLocaleString('en-NG')} and ₦${WEEKLY_FOOD_BUDGET_NAIRA.max.toLocaleString('en-NG')}.`}
              inputMode="numeric"
              value={draft.weeklyBudgetNaira}
              onChange={(weeklyBudgetNaira) => update({ weeklyBudgetNaira })}
              error={errors.weeklyBudgetNaira}
            />
          </>
        ) : null}

        {step === 'payment' ? (
          <>
            <SelectField
              label="Currency you’ll pay in"
              value={draft.billingCurrency ?? ''}
              options={CURRENCIES}
              onChange={(billingCurrency) => update({ billingCurrency })}
              error={errors.billingCurrency}
            />
            <p className="text-sm text-text-muted">
              {draft.billingCurrency === 'NGN'
                ? 'Naira payments are by card, bank transfer or USSD.'
                : 'Payments are by card, Apple Pay or Google Pay.'}{' '}
              You’ll see the price and pay after{' '}
              {words.subject === 'you' ? 'you agree' : `${words.subject} agrees`} on WhatsApp.
              Nothing is charged now.
            </p>
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <Summary draft={draft} onEdit={goTo} />
            <TextField
              label="Name for this plan"
              hint="Only you see this."
              value={draft.householdName}
              onChange={(householdName) => update({ householdName })}
              error={errors.householdName}
            />
            <div className="rounded-lg border border-border bg-surface-muted p-4 text-sm">
              <p className="font-semibold">What happens next</p>
              <p className="mt-1">
                {words.self
                  ? 'We’ll send you a WhatsApp message. Reply YES to agree, and a dietitian will be in touch to set up your plan.'
                  : `We’ll send ${words.subject} a WhatsApp message explaining the service. Nothing starts, and no health details are kept, until ${words.subject} replies YES.`}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {submit.isError ? (
        <p role="alert" className="mt-4 rounded-md border border-bad bg-bad-bg p-3 text-sm">
          {submit.error.message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => goTo(steps[index - 1]!)}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
          >
            Back
          </button>
        ) : null}
        <button
          type="submit"
          disabled={submit.isPending}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast disabled:opacity-60"
        >
          {step === 'review'
            ? submit.isPending
              ? 'Sending…'
              : words.self
                ? 'Start my plan'
                : `Invite ${draft.displayName.trim() || 'them'}`
            : 'Continue'}
        </button>
      </div>
    </form>
  );
}

function WhereStep({
  draft,
  update,
  errors,
}: {
  draft: Draft;
  update: (changes: Partial<Draft>) => void;
  errors: Errors;
}) {
  const words = personWords(draft);
  const inNigeria = draft.countryCode === 'NG';
  const fullCarePossible = canHaveFullCare(draft);
  const tier = effectiveTier(draft);

  return (
    <>
      {inNigeria ? (
        <TextField
          label="City or town"
          value={draft.city}
          onChange={(city) => update({ city })}
          error={errors.city}
          autoComplete={words.self ? 'address-level2' : 'off'}
        />
      ) : (
        <p>
          In{' '}
          {draft.countryCode === 'NG'
            ? 'Nigeria'
            : `the ${COUNTRY_NAMES[draft.countryCode ?? 'GB']}`}
          , {words.subject === 'you' ? 'you get' : `${words.subject} gets`} the weekly plan and a
          shopping list on WhatsApp. Plans use only foods sold there, in supermarkets, African and
          Caribbean shops or online, with familiar swaps where a Nigerian ingredient is hard to
          find.
        </p>
      )}

      {fullCarePossible ? (
        <ChoiceCards
          legend="Which service?"
          name="serviceTier"
          value={tier}
          onChange={(serviceTier) => update({ serviceTier })}
          options={[
            {
              value: 'full_care',
              title: 'Full care',
              description:
                'Weekly plan, plus a local vendor buys and delivers the ingredients, with a photo.',
            },
            {
              value: 'plan_only',
              title: 'Plan only',
              description:
                'Weekly plan and shopping list; the food is bought by you or the family.',
            },
          ]}
        />
      ) : inNigeria && draft.city.trim() ? (
        <p className="rounded-md bg-surface-muted p-3 text-sm">
          Deliveries are in Lagos for now, so {words.possessive} plan comes with a shopping list
          instead (plan only).
        </p>
      ) : null}

      {tier === 'full_care' ? (
        <>
          <TextField
            label="Street address"
            value={draft.line1}
            onChange={(line1) => update({ line1 })}
            error={errors.line1}
            autoComplete={words.self ? 'address-line1' : 'off'}
          />
          <TextField
            label="Area"
            optional
            hint="e.g. Surulere, Yaba, Ikeja"
            value={draft.area}
            onChange={(area) => update({ area })}
          />
          <TextField
            label="Directions for the vendor"
            optional
            hint="e.g. “Opposite the filling station, blue gate”"
            value={draft.landmark}
            onChange={(landmark) => update({ landmark })}
          />
        </>
      ) : null}
    </>
  );
}

function Summary({ draft, onEdit }: { draft: Draft; onEdit: (step: StepId) => void }) {
  const tier = effectiveTier(draft);
  const language = LANGUAGES.find(([code]) => code === draft.language)?.[1];
  const currency = CURRENCIES.find(([code]) => code === draft.billingCurrency)?.[1];
  const rows: [string, ReactNode, StepId][] = [
    [
      'For',
      draft.relationship === 'self' ? `You (${draft.displayName})` : draft.displayName,
      'who',
    ],
    ['WhatsApp', draft.phone, 'person'],
    [
      'Lives in',
      [draft.city, COUNTRY_NAMES[draft.countryCode ?? 'NG']].filter(Boolean).join(', '),
      'person',
    ],
    ['Messages in', language, 'person'],
    [
      'Service',
      tier === 'full_care' ? `Full care, delivered to ${draft.line1}` : 'Plan only (shopping list)',
      'where',
    ],
    ...(tier === 'full_care'
      ? [
          [
            'Food budget',
            `₦${parseNaira(draft.weeklyBudgetNaira).toLocaleString('en-NG')} a week`,
            'budget',
          ] as [string, ReactNode, StepId],
        ]
      : []),
    ['Pay in', currency, 'payment'],
  ];
  return (
    <dl className="divide-y divide-border rounded-lg border border-border bg-surface">
      {rows.map(([label, value, step]) => (
        <div
          key={label}
          className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 text-sm"
        >
          <dt className="w-28 text-text-muted">{label}</dt>
          <dd className="min-w-0 flex-1 break-words">{value}</dd>
          <dd>
            <button
              type="button"
              onClick={() => onEdit(step)}
              className="underline hover:text-brand"
            >
              Change<span className="sr-only"> {label.toLowerCase()}</span>
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}
