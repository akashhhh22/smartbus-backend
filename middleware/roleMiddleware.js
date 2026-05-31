const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized. User not authenticated." });
        }

        if (!allowedRoles.includes(req.user.role)) {
            console.warn(`⛔ Access Denied: User role '${req.user.role}' tried to access '${req.originalUrl}'`);
            return res.status(403).json({ error: "Access denied. Insufficient permissions." });
        }

        next();
    };
};

module.exports = roleMiddleware;
