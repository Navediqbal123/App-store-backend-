import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  // Header se token uthayein
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access Denied. No token provided." });

  try {
    // Token verify karein
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; 
    next(); // Agle step par bhejein
  } catch (err) {
    res.status(403).json({ error: "Invalid or Expired Token" });
  }
};
