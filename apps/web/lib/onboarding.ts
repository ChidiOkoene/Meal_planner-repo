import {
  type BillingCurrency,
  createRecipientSchema,
  DEFAULT_TIMEZONES,
  isDeliveryArea,
  normaliseMobileNumber,
  type RecipientCountry,
  type RecipientRelationship,
  type ServiceTier,
  weeklyFoodBudgetNairaSchema,
  WEEKLY_FOOD_BUDGET_NAIRA,
} from '@dyjext/shared';

// The onboarding wizard's rules, kept free of React so they can be tested on their own.
// Health details are never asked for here: nothing about health is stored until the person
// has agreed on WhatsApp (ARCHITECTURE §8.1).

export type StepId = 'who' | 'person' | 'where' | 'budget' | 'payment' | 'review';

export interface Draft {
  relationship?: RecipientRelationship;
  displayName: string;
  phone: string;
  language: 'en' | 'pcm' | 'yo' | 'ig' | 'ha';
  countryCode?: RecipientCountry;
  timezone: string;
  city: string;
  serviceTier?: ServiceTier;
  line1: string;
  area: string;
  landmark: string;
  weeklyBudgetNaira: string;
  billingCurrency?: BillingCurrency;
  householdName: string;
}

export const emptyDraft = (): Draft => ({
  displayName: '',
  phone: '',
  language: 'en',
  timezone: '',
  city: '',
  line1: '',
  area: '',
  landmark: '',
  weeklyBudgetNaira: String(WEEKLY_FOOD_BUDGET_NAIRA.suggested),
  householdName: '',
});

export const COUNTRY_NAMES: Record<RecipientCountry, string> = {
  NG: 'Nigeria',
  GB: 'United Kingdom',
  US: 'United States',
  CA: 'Canada',
  IE: 'Ireland',
};

/** Time zones offered where a country has more than one. */
export const TIMEZONE_CHOICES: Partial<Record<RecipientCountry, [string, string][]>> = {
  US: [
    ['America/New_York', 'Eastern'],
    ['America/Chicago', 'Central'],
    ['America/Denver', 'Mountain'],
    ['America/Phoenix', 'Arizona'],
    ['America/Los_Angeles', 'Pacific'],
    ['America/Anchorage', 'Alaska'],
    ['Pacific/Honolulu', 'Hawaii'],
  ],
  CA: [
    ['America/St_Johns', 'Newfoundland'],
    ['America/Halifax', 'Atlantic'],
    ['America/Toronto', 'Eastern'],
    ['America/Winnipeg', 'Central'],
    ['America/Edmonton', 'Mountain'],
    ['America/Vancouver', 'Pacific'],
  ],
};

export const LANGUAGES: [Draft['language'], string][] = [
  ['en', 'English'],
  ['pcm', 'Pidgin'],
  ['yo', 'Yoruba'],
  ['ig', 'Igbo'],
  ['ha', 'Hausa'],
];

export const CURRENCIES: [BillingCurrency, string][] = [
  ['NGN', 'Naira (₦)'],
  ['GBP', 'Pounds (£)'],
  ['USD', 'US dollars ($)'],
  ['EUR', 'Euros (€)'],
  ['CAD', 'Canadian dollars (CA$)'],
];

/** Can vendors deliver to the person? Only then is full care offered. */
export function canHaveFullCare(draft: Pick<Draft, 'countryCode' | 'city'>): boolean {
  return Boolean(draft.countryCode && isDeliveryArea(draft.countryCode, draft.city));
}

/** The service tier the plan will have: the payer's choice where both are possible. */
export function effectiveTier(draft: Draft): ServiceTier {
  return canHaveFullCare(draft) ? (draft.serviceTier ?? 'full_care') : 'plan_only';
}

/** The steps for this draft: the food budget only matters when a vendor buys the food. */
export function stepsFor(draft: Draft): StepId[] {
  const steps: StepId[] = ['who', 'person', 'where'];
  if (effectiveTier(draft) === 'full_care') steps.push('budget');
  steps.push('payment', 'review');
  return steps;
}

export type Errors = Partial<Record<string, string>>;

/** Problems on one step, by field name. Empty when the step is complete. */
export function validateStep(step: StepId, draft: Draft): Errors {
  const errors: Errors = {};
  switch (step) {
    case 'who':
      if (!draft.relationship) errors.relationship = 'Choose who the plan is for';
      break;
    case 'person': {
      if (!draft.displayName.trim()) errors.displayName = 'Enter a name';
      if (!draft.countryCode) errors.countryCode = 'Choose where they live';
      if (!draft.phone.trim()) errors.phone = 'Enter a WhatsApp number';
      else if (!normaliseMobileNumber(draft.phone, draft.countryCode)) {
        errors.phone = 'Enter a valid WhatsApp (mobile) number';
      }
      if (draft.countryCode && !DEFAULT_TIMEZONES[draft.countryCode] && !draft.timezone) {
        errors.timezone = 'Choose a time zone';
      }
      break;
    }
    case 'where':
      if (draft.countryCode === 'NG' && !draft.city.trim()) errors.city = 'Enter the city';
      if (effectiveTier(draft) === 'full_care' && !draft.line1.trim()) {
        errors.line1 = 'Enter the street address for deliveries';
      }
      break;
    case 'budget': {
      const result = weeklyFoodBudgetNairaSchema.safeParse(parseNaira(draft.weeklyBudgetNaira));
      if (!result.success) errors.weeklyBudgetNaira = result.error.issues[0]?.message;
      break;
    }
    case 'payment':
      if (!draft.billingCurrency) errors.billingCurrency = 'Choose a currency';
      break;
    case 'review':
      if (!draft.householdName.trim()) errors.householdName = 'Give this plan a name';
      break;
  }
  return errors;
}

/** The first step that isn't complete, so a resumed draft opens in the right place. */
export function firstIncompleteStep(draft: Draft): StepId {
  return (
    stepsFor(draft).find((step) => Object.keys(validateStep(step, draft)).length > 0) ?? 'review'
  );
}

/**
 * Where to reopen a saved draft: the step the person was on, unless an earlier step is now
 * incomplete (or the saved step no longer applies, e.g. the budget after switching to plan only).
 */
export function resumeStep(draft: Draft, savedStep: StepId): StepId {
  const steps = stepsFor(draft);
  const incomplete = firstIncompleteStep(draft);
  const savedIndex = steps.indexOf(savedStep);
  return savedIndex !== -1 && savedIndex <= steps.indexOf(incomplete) ? savedStep : incomplete;
}

/** "45,000" or "₦45000" → 45000; anything else → NaN. */
export function parseNaira(text: string): number {
  const cleaned = text.replace(/[₦,\s]/g, '');
  return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

/** Body of POST /v1/households. */
export function householdPayload(draft: Draft) {
  return {
    name: draft.householdName.trim(),
    billingCurrency: draft.billingCurrency,
    ...(effectiveTier(draft) === 'full_care'
      ? { weeklyFoodBudgetNaira: parseNaira(draft.weeklyBudgetNaira) }
      : {}),
  };
}

/** Body of POST /v1/households/:id/recipients, checked with the API's own schema. */
export function recipientPayload(draft: Draft) {
  const tier = effectiveTier(draft);
  const body = {
    relationship: draft.relationship,
    displayName: draft.displayName.trim(),
    phone: draft.phone,
    language: draft.language,
    countryCode: draft.countryCode,
    timezone: draft.timezone || undefined,
    serviceTier: tier,
    address:
      tier === 'full_care'
        ? {
            line1: draft.line1.trim(),
            area: draft.area.trim() || undefined,
            city: draft.city.trim(),
            landmark: draft.landmark.trim() || undefined,
          }
        : undefined,
  };
  // Same rules as the API, so the last step can't fail on validation.
  createRecipientSchema.parse(body);
  return body;
}

/** A starting name for the plan, e.g. "Mama's plan" or "My plan". */
export function suggestedHouseholdName(draft: Draft): string {
  if (draft.relationship === 'self') return 'My plan';
  const name = draft.displayName.trim();
  return name ? `${name}’s plan` : '';
}

/** Currency guessed from the browser's region (the payer can change it). */
export function guessCurrency(locale: string | undefined): BillingCurrency {
  const region = locale?.split('-')[1]?.toUpperCase();
  switch (region) {
    case 'NG':
      return 'NGN';
    case 'US':
      return 'USD';
    case 'CA':
      return 'CAD';
    case 'GB':
      return 'GBP';
    case 'IE':
    case 'DE':
    case 'FR':
    case 'NL':
    case 'IT':
    case 'ES':
    case 'BE':
      return 'EUR';
    default:
      return 'GBP';
  }
}

/** Words for the person, depending on who they are to the payer. */
export function personWords(draft: Pick<Draft, 'relationship' | 'displayName'>) {
  const self = draft.relationship === 'self';
  const name = draft.displayName.trim() || 'them';
  return {
    self,
    /** "you" or the person's name. */
    subject: self ? 'you' : name,
    /** "your" or "Mama's". */
    possessive: self ? 'your' : `${name}’s`,
  };
}
