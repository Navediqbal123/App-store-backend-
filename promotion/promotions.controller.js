const service = require("./promotions.service");

const createPromotion = async (req, res) => {
  const result = await service.createPromotion(req.body);
  res.json(result);
};

const getActivePromotions = async (req, res) => {
  const result = await service.getActivePromotions();
  res.json(result);
};

const togglePromotion = async (req, res) => {
  const result = await service.togglePromotion(req.params.id);
  res.json(result);
};

module.exports = {
  createPromotion,
  getActivePromotions,
  togglePromotion
};
