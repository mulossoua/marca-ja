import type { NextFunction, Request, Response } from "express";
import * as service from "./notification.service";
import { errors } from "../../utils/httpError";

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    res.json(await service.listMyNotifications(req.auth.userId));
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw errors.unauthorized();
    res.json(await service.markAsRead(req.auth.userId, req.params.notificationId));
  } catch (err) {
    next(err);
  }
}
