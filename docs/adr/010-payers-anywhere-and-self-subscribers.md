# ADR 010: Payers anywhere, self-subscribers, and two service tiers

**Status:** Accepted

## Context

The first design assumed one customer: a family member abroad (usually in the UK) paying in pounds for a parent in Lagos. Two other customers are just as real:

- **Payers in Nigeria** paying for a parent or relative, in naira.
- **Self-subscribers**: someone living with diabetes or high blood pressure who pays for their own plan, wherever they live.

Some recipients also live where we have no vendors: elsewhere in Nigeria, or abroad.

## Decision

1. **A payer can live anywhere.** Nothing in the product assumes the payer is abroad.
2. **The payer can be the recipient.** Onboarding asks "Who is this for?": _me_, _a parent_ or _another relative or friend_. For _me_, the recipient record is linked to the payer's own account, so they see their plan in the web app as well as on WhatsApp.
3. **Consent is unchanged.** Every recipient, including a self-subscriber, agrees on WhatsApp before any health data is stored. For a self-subscriber this also proves they own the number.
4. **Two service tiers, chosen by where the recipient lives:**
   - **Full care:** weekly plan, dietitian review, WhatsApp check-ins, and ingredients bought and delivered by a local vendor. Only in delivery areas (Lagos first).
   - **Plan only:** the same weekly plan, dietitian review and check-ins, plus a shopping list. The recipient buys their own food. Available anywhere WhatsApp works. No vendor, no food charges.
5. **Two payment providers behind one interface**, chosen by the household's billing currency:
   - **Paystack** for naira (and later other African currencies). Nigerian cards often fail on foreign processors, and Paystack also offers bank transfer and USSD.
   - **Stripe** for GBP, USD, EUR and CAD.
   - The rest of the system talks to a `PaymentGateway` interface, never to a provider directly.
6. **Prices are set per currency** in a price book, not converted from pounds. The naira price is set for local affordability.
7. **No currency conversion when none is needed.** A naira payer with a Lagos recipient pays in naira, and the food is bought in naira: no FX rate, no FX margin.

## Consequences

- Data model: `recipients.relationship` (`self`, `parent`, `relative`, `other`), an optional `recipients.user_id` for self-subscribers, and a service tier per recipient (`full_care`, `plan_only`).
- Billing stores which provider holds each subscription (`provider`, `provider_subscription_id`) instead of a Stripe-only field. Webhooks from both providers are verified and processed idempotently.
- The ledger has cash accounts per provider and currency, e.g. `cash:stripe_gbp` and `cash:paystack_ngn`.
- Plan-only recipients skip orders, vendors and food charges. The planner still works from the Nigerian catalogue; for recipients abroad, the dietitian checks at intake that they can get the ingredients.
- Payers in Nigeria are covered by Nigeria's NDPA as well as recipients; UK and EU GDPR apply to payers there.
- The food-wallet question (ADR 008) also has to be checked against Central Bank of Nigeria rules for naira payers. Charging per order, without a stored balance, avoids the question in both places.
- Not in scope yet: delivery outside Lagos, cuisines other than Nigerian, and payment providers beyond Paystack and Stripe.
