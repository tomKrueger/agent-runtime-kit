/**
 * @param {string} url
 * @returns {boolean}
 */
export function isLocalSupabaseUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.hostname === "127.0.0.1" || u.hostname === "localhost";
  } catch {
    return /^(https?:\/\/)(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url);
  }
}
