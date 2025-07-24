// utils/subscriptionTiers.js

export const SUBSCRIPTIONS = [
  { type: 'unlimited', sats: 15000, durationDays: 30, listingCount: Infinity },
  { type: 'pro',       sats: 10000, durationDays: 30, listingCount: 5 },
  { type: 'basic',     sats: 5000,  durationDays: 90, listingCount: 1 },
];

/**
 * Returns the highest matching tier where amountSats >= sats required
 */
export function determineSubscription(amountSats) {
  // Sort descending to match the best (highest) eligible tier
  const sorted = [...SUBSCRIPTIONS].sort((a, b) => b.sats - a.sats);
  for (const sub of sorted) {
    if (amountSats >= sub.sats) return sub;
  }
  return null;
}
