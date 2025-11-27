const express = require("express");
const router = express.Router();
const controller = require("./promotions.controller");

router.post("/create", controller.createPromotion);
router.get("/active", controller.getActivePromotions);
router.put("/toggle/:id", controller.togglePromotion);

module.exports = router;
