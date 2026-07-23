import rateLimit from "express-rate-limit";

// Throttle the unauthenticated auth endpoints (login/signup/google) to slow
// down credential brute-force and signup abuse. 10 attempts per IP per 15 min;
// the standard RateLimit-* headers are returned so clients can back off.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});
