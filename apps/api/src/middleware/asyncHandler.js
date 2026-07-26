// ============================================================================
// ASYNC HANDLER — wraps async Express middleware to catch errors
// ============================================================================
// Express 4 does not catch rejected promises in async middleware.
// This wrapper forwards errors to the centralized error handler.
// ============================================================================

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}