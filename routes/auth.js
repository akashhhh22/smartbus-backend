const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { encryptData, decryptData } = require("../utils/encryption");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Safe decryption helper - returns original value on failure
const safeDecrypt = (value) => {
    try {
        return decryptData(value);
    } catch (e) {
        console.log("⚠️ Field decryption failed, using fallback");
        return value;
    }
};

// ================= SIGNUP =================
router.post("/signup", async (req, res) => {
    try {
        const { name, phone, email, password, role } = req.body;

        if (!name || !phone || !email || !password || !role) {
            return res.status(400).json({ error: "All fields required" });
        }

        // Normalize email to lowercase
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists (inefficient loop, but preserves logic for now)
        // Ideally schema should have email_hash
        const users = await User.find();
        const existingUser = users.find(u => {
            try {
                const dec = decryptData(u.email);
                return dec && dec.toLowerCase().trim() === normalizedEmail;
            } catch (err) {
                return false;
            }
        });

        if (existingUser) {
            return res.status(400).json({ error: "Email already registered" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            phone: encryptData(phone),
            email: encryptData(normalizedEmail),
            password: hashedPassword,
            role
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: "User registered successfully"
        });
    } catch (err) {
        console.error("Signup failed:", err.message);
        res.status(500).json({ error: "Signup failed" });
    }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Find user by decrypting emails
        const users = await User.find();
        let user = null;

        // Optimization: Use for element of syntax often slightly cleaner/faster
        for (const u of users) {
            const decryptedEmail = decryptData(u.email);
            if (decryptedEmail && decryptedEmail.toLowerCase().trim() === normalizedEmail) {
                user = u;
                break;
            }
        }

        if (!user) {
            return res.status(404).json({ error: "User not found" }); // Or invalid credentials
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" } // 1 Day expiry as requested
        );

        // Decrypt RFID if present
        let decryptedRfid = null;
        try {
            if (user.rfid_uid) {
                decryptedRfid = decryptData(user.rfid_uid);
            }
        } catch (e) { /* ignore */ }

        const responseData = {
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: safeDecrypt(user.email),
                phone: safeDecrypt(user.phone), // Careful if phone is missing
                role: user.role,
                wallet_balance: user.wallet_balance,
                rfid_uid: decryptedRfid
            }
        };

        res.json(responseData);
    } catch (err) {
        console.error("Login failed:", err.message);
        res.status(500).json({ error: "Login failed" });
    }
});

// ================= GET CURRENT USER =================
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let decryptedRfid = null;
        if (user.rfid_uid) {
            decryptedRfid = decryptData(user.rfid_uid);
        }

        res.json({
            id: user._id,
            name: user.name,
            email: safeDecrypt(user.email),
            phone: safeDecrypt(user.phone),
            role: user.role,
            wallet_balance: user.wallet_balance,
            rfid_uid: decryptedRfid
        });
    } catch (err) {
        console.error("Get user error:", err.message);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

module.exports = router;
