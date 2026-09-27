import { Router } from "express";
import * as controller from "./business.controller";
import * as planController from "../plan/plan.controller";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requireBusinessAccess } from "../../middleware/tenant";

const router = Router();

// Descoberta pública — sem autenticação (regra 7: explorar antes do login é permitido).
router.get("/search", controller.search);

// Qualquer utilizador autenticado pode criar um negócio: é este acto que o promove
// a BUSINESS_MANAGER (ver business.service.createBusiness). Exigir o papel aqui
// antes de o ter tornaria impossível criar o primeiro estabelecimento.
router.post("/", requireAuth, controller.create);
router.get("/mine", requireAuth, controller.listMine);

// A autoridade real é o registo BusinessMember (verificado em requireBusinessAccess),
// nunca a claim "role" do JWT — essa claim é só um snapshot do momento do login e fica
// desactualizada assim que o utilizador é promovido a gestor (ver nota acima).
router.post("/:businessId/branches", requireAuth, requireBusinessAccess(), controller.createBranch);
router.get(
  "/:businessId/branches",
  requireAuth,
  requireBusinessAccess(),
  controller.listBranches,
);

// Mudar de plano ainda não tem billing real associado (regra 47) — por agora é uma
// operação administrativa da plataforma, nunca auto-serviço do gestor.
router.patch("/:businessId/plan", requireAuth, requireRole("PLATFORM_ADMIN"), planController.changePlan);

export default router;
