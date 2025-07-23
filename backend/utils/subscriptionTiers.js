// utils/subscriptionTiers.js

export const SUBSCRIPTIONS = [
  { type: 'unlimited', sats: 150000, durationDays: 30, listingCount: Infinity },
  { type: 'pro',       sats: 50000,  durationDays: 30, listingCount: 5 },
  { type: 'basic',     sats: 15000,  durationDays: 90, listingCount: 1 },
];

export function determineSubscription(amountSats) {
  for (const sub of SUBSCRIPTIONS) {
    if (amountSats >= sub.sats) return sub;
  }
  return null;
}
