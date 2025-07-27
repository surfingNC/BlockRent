// utils/subscriptionTiers.js

export const SUBSCRIPTIONS = [
  {
    type: 'unlimited',
    sats: 15000,
    min: 15000,
    max: Infinity,
    durationDays: 30,
    listingCount: Infinity,
  },
  {
    type: 'pro',
    sats: 10000,
    min: 10000,
    max: 14999,
    durationDays: Infinity, // 👈 infinite access
    listingCount: 5,
  },
  {
    type: 'basic',
    sats: 5000,
    min: 5000,
    max: 9999,
    durationDays: Infinity, // 👈 infinite access
    listingCount: 1,
  },
];

/**
 * Returns the matching tier for a given sats amount using range logic
 */
export function determineSubscription(amountSats) {
  return SUBSCRIPTIONS.find(
    (tier) => amountSats >= tier.min && amountSats <= tier.max
  ) || null;
}
