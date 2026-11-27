import { describe, expect, it } from 'vitest';
import {
  type Draft,
  emptyDraft,
  firstIncompleteStep,
  guessCurrency,
  householdPayload,
  parseNaira,
  resumeStep,
  recipientPayload,
  stepsFor,
  suggestedHouseholdName,
  validateStep,
} from './onboarding';

const draft = (overrides: Partial<Draft>): Draft => ({ ...emptyDraft(), ...overrides });

const mamaInLagos = draft({
  relationship: 'parent',
  displayName: 'Mama',
  phone: '0803 123 4567',
  language: 'yo',
  countryCode: 'NG',
  city: 'Lagos',
  line1: '12 Example Street',
  area: 'Surulere',
  billingCurrency: 'GBP',
  householdName: 'Mama’s plan',
});

const meInLondon = draft({
  relationship: 'self',
  displayName: 'Tunde',
  phone: '07911 123456',
  countryCode: 'GB',
  billingCurrency: 'GBP',
  householdName: 'My plan',
});

describe('onboarding steps', () => {
  it('asks about the food budget only for full care', () => {
    expect(stepsFor(mamaInLagos)).toEqual([
      'who',
      'person',
      'where',
      'budget',
      'payment',
      'review',
    ]);
    expect(stepsFor({ ...mamaInLagos, serviceTier: 'plan_only' })).not.toContain('budget');
    expect(stepsFor({ ...mamaInLagos, city: 'Abuja' })).not.toContain('budget');
    expect(stepsFor(meInLondon)).toEqual(['who', 'person', 'where', 'payment', 'review']);
  });

  it('resumes at the first step that is not complete', () => {
    expect(firstIncompleteStep(emptyDraft())).toBe('who');
    expect(firstIncompleteStep({ ...mamaInLagos, phone: '' })).toBe('person');
    expect(firstIncompleteStep({ ...mamaInLagos, line1: '' })).toBe('where');
    expect(firstIncompleteStep({ ...mamaInLagos, billingCurrency: undefined })).toBe('payment');
    expect(firstIncompleteStep(mamaInLagos)).toBe('review');
  });

  it('reopens a saved draft where the person left off', () => {
    // Abroad, later steps are already complete; it still reopens where they were.
    expect(resumeStep(meInLondon, 'where')).toBe('where');
    // An earlier gap comes first.
    expect(resumeStep({ ...meInLondon, phone: '' }, 'payment')).toBe('person');
    // A step that no longer applies falls back to the first incomplete one.
    expect(
      resumeStep({ ...mamaInLagos, serviceTier: 'plan_only', householdName: '' }, 'budget'),
    ).toBe('review');
  });

  it('checks each step with clear messages', () => {
    expect(validateStep('who', emptyDraft())).toEqual({
      relationship: 'Choose who the plan is for',
    });
    expect(validateStep('person', { ...meInLondon, phone: '020 7946 0018' })).toEqual({
      phone: 'Enter a valid WhatsApp (mobile) number',
    });
    expect(
      validateStep('person', { ...meInLondon, countryCode: 'US', phone: '+1 415 555 2671' }),
    ).toEqual({ timezone: 'Choose a time zone' });
    expect(validateStep('where', { ...mamaInLagos, city: '' })).toHaveProperty('city');
    expect(validateStep('budget', { ...mamaInLagos, weeklyBudgetNaira: '500' })).toEqual({
      weeklyBudgetNaira: 'At least ₦10,000',
    });
    expect(validateStep('budget', { ...mamaInLagos, weeklyBudgetNaira: 'lots' })).toHaveProperty(
      'weeklyBudgetNaira',
    );
  });
});

describe('what is sent to the API', () => {
  it('builds a full-care parent in Lagos, with address and budget', () => {
    expect(householdPayload({ ...mamaInLagos, weeklyBudgetNaira: '₦45,000' })).toEqual({
      name: 'Mama’s plan',
      billingCurrency: 'GBP',
      weeklyFoodBudgetNaira: 45_000,
    });
    expect(recipientPayload(mamaInLagos)).toMatchObject({
      relationship: 'parent',
      serviceTier: 'full_care',
      address: { line1: '12 Example Street', area: 'Surulere', city: 'Lagos' },
    });
  });

  it('builds a plan-only self-subscriber abroad, with no address or budget', () => {
    expect(householdPayload(meInLondon)).toEqual({ name: 'My plan', billingCurrency: 'GBP' });
    expect(recipientPayload(meInLondon)).toMatchObject({
      relationship: 'self',
      serviceTier: 'plan_only',
      address: undefined,
    });
  });

  it('lets a Lagos payer choose plan only', () => {
    const planOnly = { ...mamaInLagos, serviceTier: 'plan_only' as const };
    expect(householdPayload(planOnly)).not.toHaveProperty('weeklyFoodBudgetNaira');
    expect(recipientPayload(planOnly).address).toBeUndefined();
  });
});

describe('helpers', () => {
  it('reads naira amounts however they are typed', () => {
    expect(parseNaira('45,000')).toBe(45_000);
    expect(parseNaira('₦ 60000')).toBe(60_000);
    expect(parseNaira('45k')).toBeNaN();
  });

  it('suggests a name and a currency', () => {
    expect(suggestedHouseholdName(meInLondon)).toBe('My plan');
    expect(suggestedHouseholdName(mamaInLagos)).toBe('Mama’s plan');
    expect(guessCurrency('en-NG')).toBe('NGN');
    expect(guessCurrency('en-US')).toBe('USD');
    expect(guessCurrency('fr-FR')).toBe('EUR');
    expect(guessCurrency('en')).toBe('GBP');
  });
});
