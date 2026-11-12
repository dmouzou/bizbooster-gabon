const TEST_AD_ID_PREFIXES = [
  "test_",
  "test-",
  "ad-test",
  "ad_test",
  "demo_",
  "demo-",
];

const TEST_USER_ID_PREFIXES = [
  "test_",
  "test-",
  "user_test_",
  "demo_",
  "demo-",
];

/**
 * Determines whether an ad is genuine test content based strictly on
 * explicit test/demo ID prefixes on the ad ID or owner user ID.
 */
export function isExplicitTestAd(adId?: string, userId?: string): boolean {
  const cleanAdId = (adId || "").trim().toLowerCase();
  if (TEST_AD_ID_PREFIXES.some((prefix) => cleanAdId.startsWith(prefix))) {
    return true;
  }
  const cleanUserId = (userId || "").trim().toLowerCase();
  if (TEST_USER_ID_PREFIXES.some((prefix) => cleanUserId.startsWith(prefix))) {
    return true;
  }
  return false;
}

