import express from "express";
import * as controller from "./promotions.controller.js";

const router = express.Router();

router.post("/create", controller.createPromotion);
router.get("/active", controller.getActivePromotions);
router.put("/toggle/:id", controller.togglePromotion);

export default router;
