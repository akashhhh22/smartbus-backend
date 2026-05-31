const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const { decryptData } = require("../utils/encryption");

const router = express.Router();

// ================= GET PASSENGER PROFILE =================
router.get("/profile", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "passenger") {
            return res.status(403).json({ error: "Access denied. Passenger only." });
        }

        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Decrypt RFID safely
        let decryptedRfid = null;
        if (user.rfid_uid) decryptedRfid = decryptData(user.rfid_uid);

        res.json({
            id: user._id,
            name: user.name,
            email: decryptData(user.email),
            phone: decryptData(user.phone), // assuming phone is encrypted
            role: user.role,
            wallet_balance: user.wallet_balance,
            rfid_uid: decryptedRfid
        });
    } catch (err) {
        console.error("Get passenger profile error:", err);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// ================= GET WALLET INFO =================
router.get("/wallet", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "passenger") {
            return res.status(403).json({ error: "Access denied. Passenger only." });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let decryptedRfid = null;
        if (user.rfid_uid) decryptedRfid = decryptData(user.rfid_uid);

        res.json({
            balance: user.wallet_balance || 0,
            rfid_uid: decryptedRfid
        });
    } catch (err) {
        console.error("Get wallet error:", err);
        res.status(500).json({ error: "Failed to fetch wallet" });
    }
});

// ================= GET TRIP HISTORY =================
router.get("/trips", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "passenger") {
            return res.status(403).json({ error: "Access denied. Passenger only." });
        }

        // Mock trip data
        const trips = [
            {
                id: 1,
                route: "Route 42 - City Center",
                time: "Today, 9:30 AM",
                fare: 15,
                date: new Date()
            },
            {
                id: 2,
                route: "Route 18 - University",
                time: "Today, 8:15 AM",
                fare: 20,
                date: new Date()
            },
            {
                id: 3,
                route: "Route 7 - Mall Road",
                time: "Yesterday, 6:45 PM",
                fare: 18,
                date: new Date(Date.now() - 86400000)
            }
        ];

        res.json({ trips });
    } catch (err) {
        console.error("Get trips error:", err);
        res.status(500).json({ error: "Failed to fetch trips" });
    }
});

// ================= RECHARGE WALLET =================
router.post("/recharge", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "passenger") {
            return res.status(403).json({ error: "Access denied. Passenger only." });
        }

        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.wallet_balance += amount;
        await user.save();

        res.json({
            message: "Wallet recharged successfully",
            new_balance: user.wallet_balance
        });
    } catch (err) {
        console.error("Recharge wallet error:", err);
        res.status(500).json({ error: "Failed to recharge wallet" });
    }
});

module.exports = router;
