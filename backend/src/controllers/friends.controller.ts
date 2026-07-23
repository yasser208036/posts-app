import { Request, Response, NextFunction } from "express";
import * as friendsData from "../friends.data";
import * as usersData from "../users.data";

export async function sendRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { receiverId } = req.body ?? {};

    if (typeof receiverId !== "string" || !receiverId.trim()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: { receiverId: "Required" },
      });
    }

    if (receiverId === req.userId) {
      return res.status(400).json({
        message: "Cannot send a request to yourself",
      });
    }

    const targetUser = await usersData.findUserById(receiverId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const activeRequestExists = await friendsData.existingActiveRequest(
      req.userId!,
      receiverId,
    );
    if (activeRequestExists) {
      return res.status(409).json({ message: "Request already exists" });
    }

    const request = await friendsData.createFriendRequest(
      req.userId!,
      receiverId,
    );
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
}

export async function listRequests(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const requests = await friendsData.listIncomingRequests(req.userId!);
    res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
}

export async function acceptRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const accepted = await friendsData.setRequestStatus(
      req.userId!,
      req.params.id,
      "accepted",
    );
    if (!accepted) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({ status: "accepted" });
  } catch (err) {
    next(err);
  }
}

export async function rejectRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rejected = await friendsData.setRequestStatus(
      req.userId!,
      req.params.id,
      "rejected",
    );
    if (!rejected) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({ status: "rejected" });
  } catch (err) {
    next(err);
  }
}

export async function requestCount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const count = await friendsData.countIncomingRequests(req.userId!);
    res.status(200).json({ count });
  } catch (err) {
    next(err);
  }
}

export async function listFriends(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const friends = await friendsData.listFriends(req.userId!);
    res.status(200).json(friends);
  } catch (err) {
    next(err);
  }
}

export async function listSentRequests(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const ids = await friendsData.listOutgoingPendingRequestIds(req.userId!);
    res.status(200).json(ids);
  } catch (err) {
    next(err);
  }
}
