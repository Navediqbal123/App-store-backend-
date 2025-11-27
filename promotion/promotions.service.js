const supabase = require("../../supabaseClient");

exports.createPromotion = async (data) => {
  return await supabase.from("promotions").insert({
    app_id: data.app_id,
    is_active: true
  });
};

exports.getActivePromotions = async () => {
  return await supabase.from("promotions").select("*").eq("is_active", true);
};

exports.togglePromotion = async (id) => {
  const { data: existing } = await supabase
    .from("promotions")
    .select("is_active")
    .eq("id", id)
    .single();

  return await supabase
    .from("promotions")
    .update({ is_active: !existing.is_active })
    .eq("id", id);
};
