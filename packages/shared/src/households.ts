import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { z } from 'zod';

// Households and recipients (ADR 010): payers anywhere, recipients who may be the payer, and
// two service tiers decided by where the recipient lives.

/** Currencies a household can be billed in: naira through Paystack, the rest through Stripe. */
export const BILLING_CURRENCIES = ['NGN', 'GBP', 'USD', 'EUR', 'CAD'] as const;
export const billingCurrencySchema = z.enum(BILLING_CURRENCIES);
export type BillingCurrency = z.infer<typeof billingCurrencySchema>;

/** Where vendors deliver: full care is offered only here. Becomes data with markets (#15). */
export const DELIVERY_AREAS = [{ countryCode: 'NG', city: 'Lagos' }] as const;

/**
 * Countries where a recipient can live. Nigeria, plus the countries with an ingredient
 * availability list for plans abroad (docs/diaspora-ingredients.md, #62).
 */
export const RECIPIENT_COUNTRIES = ['NG', 'GB', 'US', 'CA', 'IE'] as const;
export const recipientCountrySchema = z.enum(RECIPIENT_COUNTRIES);
export type RecipientCountry = z.infer<typeof recipientCountrySchema>;

/** Time zone used when a country has only one; elsewhere the payer must choose. */
export const DEFAULT_TIMEZONES: Partial<Record<RecipientCountry, string>> = {
  NG: 'Africa/Lagos',
  GB: 'Europe/London',
  IE: 'Europe/Dublin',
};

export const recipientRelationshipSchema = z.enum(['self', 'parent', 'relative', 'other']);
export type RecipientRelationship = z.infer<typeof recipientRelationshipSchema>;

export const serviceTierSchema = z.enum(['full_care', 'plan_only']);
export type ServiceTier = z.infer<typeof serviceTierSchema>;

export const recipientLanguageSchema = z.enum(['en', 'pcm', 'yo', 'ig', 'ha']);

export const recipientStatusSchema = z.enum(['invited', 'consented', 'active', 'paused', 'closed']);
export type RecipientStatus = z.infer<typeof recipientStatusSchema>;

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether vendors deliver to this city. */
export function isDeliveryArea(countryCode: string, city: string | undefined): boolean {
  return DELIVERY_AREAS.some(
    (area) => area.countryCode === countryCode && city !== undefined && sameText(area.city, city),
  );
}

/**
 * A WhatsApp number in international (E.164) form, e.g. "+2348031234567", or null if it isn't
 * a valid mobile number. Local forms ("0803 123 4567") are read using the recipient's country.
 */
export function normaliseMobileNumber(input: string, countryCode?: string): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), countryCode as never);
  if (!parsed?.isValid()) return null;
  const type = parsed.getType();
  // WhatsApp needs a mobile. Some countries (US, Canada) can't tell mobiles from landlines.
  if (type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE') return null;
  return parsed.number;
}

/** Body of `POST /v1/households`. The caller becomes the owner. */
export const createHouseholdSchema = z.object({
  name: z.string().trim().min(1, 'Give the household a name').max(80),
  billingCurrency: billingCurrencySchema,
});
export type CreateHousehold = z.infer<typeof createHouseholdSchema>;

export const deliveryAddressSchema = z.object({
  line1: z.string().trim().min(1, 'Enter the street address').max(120),
  line2: z.string().trim().max(120).optional(),
  /** Neighbourhood, e.g. "Surulere". */
  area: z.string().trim().max(80).optional(),
  city: z.string().trim().min(1, 'Enter the city').max(80),
  region: z.string().trim().max(80).optional(),
  /** Directions for the vendor, e.g. "Opposite the filling station, blue gate". */
  landmark: z.string().trim().max(200).optional(),
});
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

/**
 * Body of `POST /v1/households/:id/recipients`. The phone number comes back normalised to
 * E.164; the service tier defaults to full care where vendors deliver, else plan only.
 */
export const createRecipientSchema = z
  .object({
    relationship: recipientRelationshipSchema,
    displayName: z.string().trim().min(1, 'Enter a name').max(80),
    /** WhatsApp number, in international or local form. */
    phone: z.string().trim().min(1, 'Enter a WhatsApp number').max(30),
    language: recipientLanguageSchema.default('en'),
    countryCode: recipientCountrySchema,
    /** IANA time zone, e.g. "America/New_York". Required where a country has several. */
    timezone: z.string().trim().optional(),
    serviceTier: serviceTierSchema.optional(),
    /** Required for full care. */
    address: deliveryAddressSchema.optional(),
  })
  .transform((value, ctx) => {
    const phoneE164 = normaliseMobileNumber(value.phone, value.countryCode);
    if (!phoneE164) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a valid WhatsApp (mobile) number, e.g. +234 803 123 4567',
      });
    }

    const timezone = value.timezone ?? DEFAULT_TIMEZONES[value.countryCode];
    if (!timezone) {
      ctx.addIssue({
        code: 'custom',
        path: ['timezone'],
        message: 'Choose a time zone for this country',
      });
    } else if (!isTimeZone(timezone)) {
      ctx.addIssue({ code: 'custom', path: ['timezone'], message: 'Unknown time zone' });
    }

    const deliverable = isDeliveryArea(value.countryCode, value.address?.city);
    const serviceTier = value.serviceTier ?? (deliverable ? 'full_care' : 'plan_only');
    if (serviceTier === 'full_care') {
      if (!value.address) {
        ctx.addIssue({
          code: 'custom',
          path: ['address'],
          message: 'Full care needs a delivery address',
        });
      } else if (!deliverable) {
        ctx.addIssue({
          code: 'custom',
          path: ['serviceTier'],
          message: 'Delivery is only available in Lagos for now; choose plan only',
        });
      }
    }

    return {
      relationship: value.relationship,
      displayName: value.displayName,
      phoneE164: phoneE164 ?? '',
      language: value.language,
      countryCode: value.countryCode,
      timezone: timezone ?? '',
      serviceTier,
      // Plan-only recipients need no address; any given is not stored.
      address: serviceTier === 'full_care' ? value.address : undefined,
    };
  });
export type CreateRecipientInput = z.input<typeof createRecipientSchema>;
export type CreateRecipient = z.output<typeof createRecipientSchema>;

function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

// ─── Recipient status ────────────────────────────────────────────────────────

/**
 * Status changes a payer may make. Consent (invited → consented) and starting the service
 * (consented → active) are made by the system and the dietitian, not here.
 */
const PAYER_TRANSITIONS: Record<RecipientStatus, readonly RecipientStatus[]> = {
  invited: ['closed'],
  consented: ['closed'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  closed: [],
};

export function canPayerChangeStatus(from: RecipientStatus, to: RecipientStatus): boolean {
  return PAYER_TRANSITIONS[from].includes(to);
}

/** Body of `POST /v1/households/:id/recipients/:recipientId/status`. */
export const recipientStatusChangeSchema = z.object({
  status: z.enum(['active', 'paused', 'closed']),
});

export const householdRecipientParamsSchema = z.object({
  id: z.uuid(),
  recipientId: z.uuid(),
});
