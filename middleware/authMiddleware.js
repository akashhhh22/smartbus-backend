const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");

        if (!authHeader) {
            return res.status(401).json({ error: "Access denied. No token provided." });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Invalid token format. Use 'Bearer <token>'" });
        }

        const token = authHeader.replace("Bearer ", "");

        if (!process.env.JWT_SECRET) {
            console.error("❌ FATAL: JWT_SECRET is missing in .env");
            return res.status(500).json({ error: "Server configuration error" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("Auth Error:", err.message);
        return res.status(401).json({ error: "Invalid or expired token." });
    }
};

module.exports = authMiddleware;
