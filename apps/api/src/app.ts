import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes";
import businessRoutes from "./modules/business/business.routes";
import serviceRoutes from "./modules/service/service.routes";
import professionalRoutes from "./modules/professional/professional.routes";
import availabilityRoutes from "./modules/availability/availability.routes";
import appointmentRoutes from "./modules/appointment/appointment.routes";
import appointmentMeRoutes from "./modules/appointment/appointment.me.routes";
import professionalMeRoutes from "./modules/professional/professional.me.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import reviewRoutes from "./modules/review/review.routes";
import favouriteRoutes from "./modules/favourite/favourite.routes";
import reportRoutes from "./modules/report/report.routes";
import planRoutes from "./modules/plan/plan.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { env } from "./config/env";

export function createApp() {
  const app = express();
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim());

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Sem "origin" = pedido não vindo de um browser (app mobile, curl, etc.) — permitido.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error("Origem não autorizada pelo CORS."));
      },
    }),
  );
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/auth", authRoutes);
  app.use("/businesses", businessRoutes);
  app.use("/branches/:branchId/services", serviceRoutes);
  app.use("/branches/:branchId/professionals", professionalRoutes);
  app.use("/branches/:branchId/availability", availabilityRoutes);
  app.use("/branches/:branchId/appointments", appointmentRoutes);
  app.use("/appointments", appointmentMeRoutes);
  app.use("/me/professional", professionalMeRoutes);
  app.use("/notifications", notificationRoutes);
  app.use("/branches/:branchId/reviews", reviewRoutes);
  app.use("/favourites", favouriteRoutes);
  app.use("/branches/:branchId/reports", reportRoutes);
  app.use("/plans", planRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
