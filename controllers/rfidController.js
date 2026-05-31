const User = require("../models/User");
const { hashData, encryptData } = require("../utils/encryption");


exports.scanRFID = async (req, res) => {
    try {
        const { uid } = req.body;

        if (!uid) {
            return res.status(400).send("UID_MISSING");
        }

        // ✅ Hash UID for user lookup
        const hashedUid = hashData(uid);

        // ✅ Emit rfid_scanned immediately — conductor dashboard + passenger linking both listen for this
        const io = req.app.get("io");
        if (io) {
            io.emit("rfid_scanned", {
                uid,
                uidHash: hashedUid,
                timestamp: Date.now()
            });
        }

        // ✅ Optional: check if a user is linked (no deduction — just informational)
        const user = await User.findOne({ rfid_uid_hash: hashedUid });

        if (!user) {
            console.log(`❌ Card scanned but no user linked. UID: ${uid}`);
            return res.send("USER_NOT_FOUND");
        }

        console.log(`✅ Card scanned for user: ${user.name}`);

        // ✅ Fare deduction happens ONLY via POST /api/conductor/deduct-fare
        return res.send("UID_RECEIVED");

    } catch (err) {
        console.error("RFID Scan Error:", err);
        return res.status(500).send("SERVER_ERROR");
    }
};


exports.linkRFID = async (req, res) => {
    try {
        const { uid } = req.body;

        if (!uid) {
            return res.status(400).json({ error: "UID is required" });
        }

        // req.user.id comes from authMiddleware
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Prevent re-linking
        if (user.rfid_uid_hash) {
            return res.status(400).json({
                error: "RFID already linked to this account",
            });
        }

        // Hash UID for checking duplicates
        const uidHash = hashData(uid);

        // Ensure card not already linked to another user
        const existing = await User.findOne({ rfid_uid_hash: uidHash });
        if (existing) {
            return res.status(400).json({
                error: "This RFID card is already assigned to another user",
            });
        }

        // Encrypt UID for storage
        const encryptedUID = encryptData(uid);

        user.rfid_uid = encryptedUID;
        user.rfid_uid_hash = uidHash;

        await user.save();

        return res.json({
            success: true,
            message: "RFID Card linked successfully",
        });

    } catch (err) {
        console.error("RFID Link Error:", err);
        return res.status(500).json({ error: "Server error" });
    }
};

exports.linkRFIDByScan = async (req, res) => {
    try {
        const { uid } = req.body;

        if (!uid) return res.status(400).json({ error: "UID missing" });

        const user = await User.findById(req.user.id);

        if (user.rfid_uid_hash) {
            return res.status(400).json({ error: "RFID already linked" });
        }

        // Hash UID for checking duplicates
        const uidHash = hashData(uid);

        const existing = await User.findOne({ rfid_uid_hash: uidHash });
        if (existing) {
            return res.status(400).json({ error: "Card already assigned" });
        }

        // Encrypt and Save
        const encryptedUID = encryptData(uid);
        user.rfid_uid = encryptedUID;
        user.rfid_uid_hash = uidHash;

        await user.save();

        return res.json({
            success: true,
            message: "RFID Linked Successfully via Scan",
        });

    } catch (err) {
        console.error("Auto-Link Error:", err);
        return res.status(500).json({ error: "Server error" });
    }
};
