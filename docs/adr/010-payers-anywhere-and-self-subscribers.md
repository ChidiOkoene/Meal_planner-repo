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

8. **Abroad, plans use what can be bought there.** For plan-only recipients outside Nigeria, the planner only uses ingredients sold in the recipient's country, whether in supermarkets, African or Caribbean shops, or online. When a Nigerian ingredient can't be found, it uses a dietitian-approved substitute (for example spinach for ugu, aubergine for garden egg) or drops the dish. Starting countries: the UK, the US, Canada and Ireland. Another country opens once its availability list exists. The starting list is in [`docs/diaspora-ingredients.md`](../diaspora-ingredients.md).

## Consequences

- Data model: `recipients.relationship` (`self`, `parent`, `relative`, `other`), an optional `recipients.user_id` for self-subscribers, and a service tier per recipient (`full_care`, `plan_only`).
- Billing stores which provider holds each subscription (`provider`, `provider_subscription_id`) instead of a Stripe-only field. Webhooks from both providers are verified and processed idempotently.
- The ledger has cash accounts per provider and currency, e.g. `cash:stripe_gbp` and `cash:paystack_ngn`.
- Plan-only recipients skip orders, vendors and food charges. The planner still works from the Nigerian catalogue; for recipients abroad, the dietitian checks at intake that they can get the ingredients.
- Payers in Nigeria are covered by Nigeria's NDPA as well as recipients; UK and EU GDPR apply to payers there.
- The food-wallet question (ADR 008) also has to be checked against Central Bank of Nigeria rules for naira payers. Charging per order, without a stored balance, avoids the question in both places.
- Catalogue: `ingredient_availability` (ingredient, country, where it's sold, form such as fresh, frozen or dried, confidence) and `ingredient_substitutes` (ingredient, substitute, countries, dietitian approval). Substitutes carry their own nutrients, so the validator checks the plan as actually eaten.
- Recipients abroad say at intake whether they can reach an African or Caribbean shop; if not, shop-only ingredients count as unavailable. A "couldn't find this" reply on WhatsApp is recorded and lowers that ingredient's confidence for the country.
- Not in scope yet: delivery outside Lagos, cuisines other than Nigerian, and payment providers beyond Paystack and Stripe.
