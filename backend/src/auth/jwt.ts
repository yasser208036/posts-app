import jwt from "jsonwebtoken";
import { JwtPayload } from "../types";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-insecure-secret";
const EXPIRES_IN = "7d";

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, JWT_SECRET) as JwtPayload;
