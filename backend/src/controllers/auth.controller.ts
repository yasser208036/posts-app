import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import * as users from "../users.data";
import { hashPassword, verifyPassword } from "../auth/password";
import { signToken } from "../auth/jwt";
import { AuthResponse } from "../types";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function authResponse(user: {
  id: string;
  name: string;
  email: string;
}): AuthResponse {
  return {
    token: signToken({ sub: user.id, email: user.email }),
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;

    const existing = users.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        message: "Validation failed",
        errors: { email: "Email already exists" },
      });
    }

    const passwordHash = await hashPassword(password);
    const user = users.createUser({
      name,
      email,
      passwordHash,
      provider: "local",
    });

    res.status(201).json(authResponse(user));
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const user = users.findUserByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.status(200).json(authResponse(user));
  } catch (err) {
    next(err);
  }
}

export async function googleLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { credential } = req.body ?? {};

    if (typeof credential !== "string" || !credential) {
      return res.status(400).json({ message: "Missing Google credential" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(401).json({ message: "Invalid Google token" });
    }

    let user = users.findUserByEmail(payload.email);
    if (!user) {
      user = users.createUser({
        name: payload.name ?? payload.email,
        email: payload.email,
        passwordHash: null,
        provider: "google",
      });
    }

    res.status(200).json(authResponse(user));
  } catch (err) {
    next(err);
  }
}

export function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.userId ? users.findUserById(req.userId) : undefined;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    res.status(200).json(users.toPublicUser(user));
  } catch (err) {
    next(err);
  }
}
