const express = require("express");
const router = express.Router();

// IMPORTANT FIXED PATH
const controller = require("../promotion/promotions.controller.js");

// Routes
router.post("/create", controller.createPromotion);
router.get("/active", controller.getActivePromotions);
router.put("/toggle/:id", controller.togglePromotion);

module.exports = router;
