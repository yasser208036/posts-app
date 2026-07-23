import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { Request, Response, NextFunction } from "express";
import { validatePost } from "./middleware/validatePost";
import { validateComment } from "./middleware/validateComment";
import { validateSignup, validateLogin } from "./middleware/validateAuth";

function createMockReqRes(body: any = {}) {
  const req = { body } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe("validatePost middleware", () => {
  it("calls next() for valid post input", () => {
    const { req, res, next } = createMockReqRes({
      title: "Valid Title",
      body: "Valid body text containing more than 10 characters.",
    });

    validatePost(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects title shorter than 3 characters after trimming", () => {
    const { req, res, next } = createMockReqRes({
      title: "  ab  ",
      body: "Valid body text containing more than 10 characters.",
    });

    validatePost(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Validation failed",
      errors: { title: "Title is required and must be at least 3 characters." },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects body shorter than 10 characters after trimming", () => {
    const { req, res, next } = createMockReqRes({
      title: "Valid Title",
      body: "   short   ",
    });

    validatePost(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Validation failed",
      errors: { body: "Body is required and must be at least 10 characters." },
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("validateComment middleware", () => {
  it("calls next() for valid comment body", () => {
    const { req, res, next } = createMockReqRes({
      body: "A valid comment body",
    });

    validateComment(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only comment body", () => {
    const { req, res, next } = createMockReqRes({
      body: "   ",
    });

    validateComment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Validation failed",
      errors: { body: "Comment is required." },
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("validateAuth middleware", () => {
  it("validates signup fields correctly", () => {
    const { req, res, next } = createMockReqRes({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
    });

    validateSignup(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects signup with invalid email and short password", () => {
    const { req, res, next } = createMockReqRes({
      name: "J",
      email: "invalid-email",
      password: "123",
    });

    validateSignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Validation failed",
      errors: {
        name: "Name is required and must be at least 2 characters.",
        email: "A valid email is required.",
        password: "Password is required and must be at least 8 characters.",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("validates login fields correctly", () => {
    const { req, res, next } = createMockReqRes({
      email: "user@example.com",
      password: "somepassword",
    });

    validateLogin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
