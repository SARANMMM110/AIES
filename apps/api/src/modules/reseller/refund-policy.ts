/**
 * Central refund access policy for reseller sales.
 * Change this one flag later without rewriting checkout.
 * Does not delete customers, sales, or audit history.
 */
export const RESELLER_REFUND_REVOKES_ACCESS = true;
