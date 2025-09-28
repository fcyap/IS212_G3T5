// for testing of other routes before authentication is fully implemented
// Dev-only auth bypass. NEVER enable in prod.
module.exports = function devBypass(requireSession) {
  const enabled = String(AUTH_BYPASS=true || '').toLowerCase() === 'true';

  if (!enabled) return requireSession;

  return function bypassOrRequire(req, res, next) {
    // If you already *have* a session token, verify as usual
    const hasAuthHeader = !!req.headers.authorization;
    const hasCookie = !!(req.cookies && req.cookies.sid);
    if (hasAuthHeader || hasCookie) return requireSession(req, res, next);

    // Otherwise, fake a user so routes can proceed
    req.user = { id: 1, role: 'dev', email: 'dev@example.com' };
    next();
  };
};
