const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/user");
const Wallet = require("../models/Wallet");
const EmergencyAlert = require("../models/EmergencyAlert");
const { decryptData } = require("../utils/encryption");

const router = express.Router();

// ... (existing routes)

// ================= EMERGENCY SOS =================
router.post("/sos", authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId).select("name phone");
        if (!user) return res.status(404).json({ error: "User not found" });

        // Save alert to DB
        const alert = new EmergencyAlert({
            userId,
            location: { latitude, longitude }
        });
        await alert.save();

        // Notify via Socket.IO
        const io = req.app.get("io");
        if (io) {
            io.to("conductor_dashboards").emit("emergency_alert", {
                alertId: alert._id,
                userName: user.name,
                userPhone: decryptData(user.phone),
                location: { latitude, longitude },
                timestamp: alert.timestamp
            });
        }

        console.log(`🚨 EMERGENCY SOS from ${user.name}`);

        res.json({
            success: true,
            message: "SOS Alert sent successfully. Authorities have been notified.",
            alertId: alert._id
        });
    } catch (err) {
        console.error("SOS Error:", err);
        res.status(500).json({ error: "Failed to send SOS alert" });
    }
});

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
            rfid_uid: decryptedRfid,
            priorityType: user.priorityType || "NONE",
            isSafetyModeEnabled: user.isSafetyModeEnabled || false,
            emergencyContact: user.emergencyContact
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

        // Sync to Wallet
        let wallet = await Wallet.findOne({ userId: user._id });
        if (!wallet) {
            wallet = new Wallet({ userId: user._id, balance: 0 });
        }
        wallet.balance = user.wallet_balance;
        await wallet.save();

        res.json({
            message: "Wallet recharged successfully",
            new_balance: user.wallet_balance
        });
    } catch (err) {
        console.error("Recharge wallet error:", err);
        res.status(500).json({ error: "Failed to recharge wallet" });
    }
});

// ================= UPDATE PRIORITY TYPE =================
router.put("/priority", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "passenger") {
            return res.status(403).json({ error: "Access denied." });
        }

        const { priorityType } = req.body;
        const validTypes = ["NONE", "ELDERLY", "PHYSICALLY_CHALLENGED", "PREGNANT", "MEDICAL_CONDITION"];

        if (!validTypes.includes(priorityType)) {
            return res.status(400).json({ error: "Invalid priority type" });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        user.priorityType = priorityType;
        await user.save();

        res.json({
            success: true,
            message: "Priority status updated",
            priorityType: user.priorityType
        });
    } catch (err) {
        console.error("Priority update error:", err);
        res.status(500).json({ error: "Failed to update priority" });
    }
});

// ================= REQUEST PRIORITY SEAT =================
router.post("/request-seat", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "passenger") {
            return res.status(403).json({ error: "Access denied." });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.priorityType === "NONE") {
            return res.status(400).json({ error: "Priority status not set. Please update your profile." });
        }

        // Notify via Socket.IO
        const io = req.app.get("io");
        if (io) {
            io.to("conductor_dashboards").emit("seat_request", {
                userId: user._id,
                userName: user.name,
                priorityType: user.priorityType,
                timestamp: new Date()
            });
        }

        console.log(`💺 SEAT REQUEST from ${user.name} (${user.priorityType})`);

        res.json({
            success: true,
            message: "Seat request sent to the conductor."
        });
    } catch (err) {
        console.error("Seat request error:", err);
        res.status(500).json({ error: "Failed to request seat" });
    }
});

// ================= TOGGLE SAFETY MODE =================
router.post("/safety-mode", authMiddleware, async (req, res) => {
    try {
        const { enabled, contactName, contactPhone } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        user.isSafetyModeEnabled = enabled;
        if (contactName && contactPhone) {
            user.emergencyContact = { name: contactName, phone: contactPhone };
        }
        await user.save();

        if (enabled) {
            console.log(`🛡️ SAFETY MODE ENABLED for ${user.name}`);
            // notify conductor if they are on a trip?
            // for now, just global log/db update
        }

        res.json({
            success: true,
            message: enabled ? "Safety Mode enabled. Your location is being monitored." : "Safety Mode disabled.",
            isSafetyModeEnabled: user.isSafetyModeEnabled
        });
    } catch (err) {
        console.error("Safety Mode error:", err);
        res.status(500).json({ error: "Failed to toggle Safety Mode" });
    }
});

// ================= SAFE ARRIVAL =================
router.post("/safe-arrival", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        user.isSafetyModeEnabled = false;
        await user.save();

        // Notify via Socket.IO
        const io = req.app.get("io");
        if (io) {
            io.to("conductor_dashboards").emit("safe_arrival", {
                userId: user._id,
                userName: user.name,
                timestamp: new Date()
            });
        }

        console.log(`✅ SAFE ARRIVAL confirmed for ${user.name}`);

        res.json({
            success: true,
            message: "Glad you arrived safely! Safety Mode has been deactivated."
        });
    } catch (err) {
        console.error("Safe Arrival error:", err);
        res.status(500).json({ error: "Failed to confirm arrival" });
    }
});

module.exports = router;
