/** Environment detection — local dev vs. the deployed static site. */

/**
 * True when served from localhost / loopback / a LAN address, where
 * local-only tooling can exist (e.g. the current-events refresh endpoint
 * provided by scripts/serve.mjs). The GitHub Pages build is static, so
 * anything that needs a local server should be gated behind this flag.
 */
export function isLocalHost() {
  const h = location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    /^192\.168\./.test(h) ||
    /^10\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}
