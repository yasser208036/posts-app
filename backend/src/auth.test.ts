import { describe, expect, it } from "@jest/globals";
import { signToken, verifyToken } from "./auth/jwt";
import { hashPassword, verifyPassword } from "./auth/password";

describe("JWT auth utility", () => {
  it("signs and verifies a valid payload", () => {
    const payload = { sub: "user-123", email: "user@example.com" };
    const token = signToken(payload);

    expect(typeof token).toBe("string");

    const decoded = verifyToken(token);
    expect(decoded.sub).toBe("user-123");
    expect(decoded.email).toBe("user@example.com");
  });

  it("fails verification for an altered token", () => {
    const payload = { sub: "user-123", email: "user@example.com" };
    const token = signToken(payload);
    const tampered = token.slice(0, -5) + "xxxxx";

    expect(() => verifyToken(tampered)).toThrow();
  });
});

describe("Password auth utility", () => {
  it("hashes password and verifies successfully", async () => {
    const plain = "mySecretPassword123";
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);

    const match = await verifyPassword(plain, hash);
    expect(match).toBe(true);

    const wrongMatch = await verifyPassword("wrongPassword", hash);
    expect(wrongMatch).toBe(false);
  });
});
