const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { decryptData, hashData } = require("../utils/encryption");

const router = express.Router();

// ================= GET CONDUCTOR PROFILE =================
router.get("/profile", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "conductor") {
            return res.status(403).json({ error: "Access denied. Conductor only." });
        }

        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            id: user._id,
            name: user.name,
            email: decryptData(user.email),
            phone: decryptData(user.phone),
            role: user.role
        });
    } catch (err) {
        console.error("Get conductor profile error:", err);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// ================= GET SCAN HISTORY =================
router.get("/scans", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "conductor") {
            return res.status(403).json({ error: "Access denied. Conductor only." });
        }

        // Mock scan data - unchanged
        const scans = [
            {
                id: 1,
                passenger_uid: "A3B7C9D2",
                time: "2 minutes ago",
                amount: 15,
                timestamp: new Date()
            },
            {
                id: 2,
                passenger_uid: "F8E2D1A5",
                time: "8 minutes ago",
                amount: 20,
                timestamp: new Date(Date.now() - 480000)
            },
            {
                id: 3,
                passenger_uid: "C4B9E7F3",
                time: "15 minutes ago",
                amount: 18,
                timestamp: new Date(Date.now() - 900000)
            }
        ];

        res.json({ scans });
    } catch (err) {
        console.error("Get scans error:", err);
        res.status(500).json({ error: "Failed to fetch scans" });
    }
});

// ================= GET TODAY'S STATS (LIVE FROM DB) =================
router.get("/stats", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "conductor") {
            return res.status(403).json({ error: "Access denied. Conductor only." });
        }

        // Today's date range (midnight to now)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Count today's fare deductions
        const todayTransactions = await Transaction.find({
            type: "DEBIT",
            description: { $regex: /Bus Fare Deduction/i },
            createdAt: { $gte: todayStart }
        });

        const scans_today = todayTransactions.length;
        const total_collected = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

        // Active passengers = unique passengers who scanned today
        const uniquePassengers = new Set(todayTransactions.map(t => t.userId.toString()));
        const active_passengers = uniquePassengers.size;

        res.json({ scans_today, total_collected, active_passengers });
    } catch (err) {
        console.error("Get stats error:", err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ================= SCAN CONTROL (Start/Stop ESP32 scanning) =================
router.post("/scan-control", authMiddleware, roleMiddleware(["conductor"]), async (req, res) => {
    try {
        const { action } = req.body;

        if (!action || !['start', 'stop'].includes(action)) {
            return res.status(400).json({ error: "Action must be 'start' or 'stop'" });
        }

        const io = req.app.get("io");
        if (!io) {
            return res.status(500).json({ error: "Socket.IO not available" });
        }

        const enabled = action === 'start';
        io.to("esp32_scanners").emit("scan_mode", { enabled });

        console.log(`📡 Scan control: ${action} (enabled=${enabled})`);

        // Check if ESP32 is connected
        const esp32Room = io.sockets.adapter.rooms.get("esp32_scanners");
        const esp32Connected = esp32Room ? esp32Room.size > 0 : false;

        res.json({
            success: true,
            action,
            esp32_connected: esp32Connected,
            message: `Scanning ${enabled ? 'started' : 'stopped'}${!esp32Connected ? ' (ESP32 not connected)' : ''}`
        });
    } catch (err) {
        console.error("Scan control error:", err);
        res.status(500).json({ error: "Failed to control scanning" });
    }
});

// ================= SCAN PASSENGER (ESP32 compatible) =================
router.post("/scan", authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== "conductor") {
            return res.status(403).json({ error: "Access denied. Conductor only." });
        }

        const { rfid_uid, fare } = req.body;

        if (!rfid_uid || !fare) {
            return res.status(400).json({ error: "RFID UID and fare required" });
        }

        // Find passenger by HASHED RFID
        const hashedUid = hashData(rfid_uid);
        const passenger = await User.findOne({ rfid_uid_hash: hashedUid });

        if (!passenger) {
            return res.status(404).json({ error: "Passenger not found" });
        }

        if (passenger.wallet_balance < fare) {
            return res.status(400).json({ error: "Insufficient balance" });
        }

        // Deduct fare
        passenger.wallet_balance -= fare;
        await passenger.save();

        res.json({
            message: "Scan successful",
            passenger_name: passenger.name,
            fare_deducted: fare,
            remaining_balance: passenger.wallet_balance
        });
    } catch (err) {
        console.error("Scan error:", err);
        res.status(500).json({ error: "Scan failed" });
    }
});

// ================= GET PASSENGER BY UID (for conductor fare flow) =================
router.get("/passenger/:uid", authMiddleware, roleMiddleware(["conductor"]), async (req, res) => {
    try {
        const { uid } = req.params;

        if (!uid) {
            return res.status(400).json({ error: "UID is required" });
        }

        const hashedUid = hashData(uid);
        const passenger = await User.findOne({ rfid_uid_hash: hashedUid }).select("-password");

        if (!passenger) {
            return res.status(404).json({ error: "Passenger not found. Card not linked." });
        }

        // Get wallet balance from Wallet model (source of truth)
        const wallet = await Wallet.findOne({ userId: passenger._id });
        const balance = wallet ? wallet.balance : passenger.wallet_balance;

        res.json({
            name: passenger.name,
            rfid_linked: !!passenger.rfid_uid_hash,
            wallet_balance: balance
        });
    } catch (err) {
        console.error("Get passenger by UID error:", err);
        res.status(500).json({ error: "Failed to fetch passenger" });
    }
});

// ================= DEDUCT FARE (conductor fare collection) =================
router.post("/deduct-fare", authMiddleware, roleMiddleware(["conductor"]), async (req, res) => {
    try {
        const { uid, fare } = req.body;

        if (!uid || fare === undefined || fare === null) {
            return res.status(400).json({ error: "UID and fare are required" });
        }

        const fareNum = Number(fare);
        if (isNaN(fareNum) || fareNum <= 0) {
            return res.status(400).json({ error: "Fare must be a positive number" });
        }

        // Find passenger by hashed UID
        const hashedUid = hashData(uid);
        const passenger = await User.findOne({ rfid_uid_hash: hashedUid });

        if (!passenger) {
            return res.status(404).json({ error: "Passenger not found" });
        }

        // Get wallet (source of truth for balance)
        const wallet = await Wallet.findOne({ userId: passenger._id });

        if (!wallet) {
            return res.status(404).json({ error: "Passenger wallet not found" });
        }

        if (wallet.balance < fareNum) {
            return res.status(400).json({ error: `Insufficient balance. Available: ₹${wallet.balance}` });
        }

        // Deduct from Wallet
        wallet.balance -= fareNum;
        await wallet.save();

        // Sync User model balance
        passenger.wallet_balance = wallet.balance;
        await passenger.save();

        // Create Transaction record
        await Transaction.create({
            userId: passenger._id,
            type: "DEBIT",
            amount: fareNum,
            description: `Bus Fare Deduction by Conductor`
        });

        // Emit socket event to conductor dashboards only
        const io = req.app.get("io");
        if (io) {
            io.to("conductor_dashboards").emit("fare_deducted", {
                passengerName: passenger.name,
                fare: fareNum,
                newBalance: wallet.balance,
                timestamp: new Date()
            });
        }

        console.log(`✅ Fare ₹${fareNum} deducted for ${passenger.name}. New balance: ₹${wallet.balance}`);

        res.json({
            success: true,
            message: "Fare deducted successfully",
            passenger_name: passenger.name,
            fare_deducted: fareNum,
            new_balance: wallet.balance
        });
    } catch (err) {
        console.error("Deduct fare error:", err);
        res.status(500).json({ error: "Failed to deduct fare" });
    }
});

module.exports = router;
