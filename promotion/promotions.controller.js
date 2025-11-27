const service = require("./promotions.service");

exports.createPromotion = async (req, res) => {
  const result = await service.createPromotion(req.body);
  res.json(result);
};

exports.getActivePromotions = async (req, res) => {
  const result = await service.getActivePromotions();
  res.json(result);
};

exports.togglePromotion = async (req, res) => {
  const result = await service.togglePromotion(req.params.id);
  res.json(result);
};
