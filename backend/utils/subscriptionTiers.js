export const SUBSCRIPTIONS = [
  {
    type: 'unlimited',
    sats: 15000,
    min: 15000,
    max: Infinity,
    durationDays: 30, // 30-day access
    listingCount: Infinity,
  },
  {
    type: 'pro',
    sats: 10000,
    min: 10000,
    max: 14999,
    durationDays: null, // Lifetime access
    listingCount: 5,
  },
  {
    type: 'basic',
    sats: 1000,
    min: 1000,
    max: 9999,
    durationDays: null, // Lifetime access
    listingCount: 1,
  },
];

/**
 * Finds a subscription tier based on sats amount.
 * Returns null if no match is found.
 */
export function determineSubscription(amountSats) {
  return (
    SUBSCRIPTIONS.find(
      (tier) => amountSats >= tier.min && amountSats <= tier.max
    ) || null
  );
}

/**
 * Returns the expiration date based on durationDays.
 * If durationDays is null, returns null to indicate lifetime access.
 */
export function getExpirationDate(tier) {
  if (!tier || tier.durationDays === null) return null;
  return new Date(Date.now() + tier.durationDays * 24 * 60 * 60 * 1000);
}
