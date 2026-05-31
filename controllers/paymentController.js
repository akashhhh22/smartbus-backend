const Razorpay = require("razorpay");
const crypto = require("crypto"); // Native crypto for HMAC (Razorpay standard)
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { encryptData } = require("../utils/encryption"); // Use our secure AES encryption
require("dotenv").config();

// ✅ 1. Validate Environment Variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("\n❌ FATAL ERROR: Razorpay keys are missing in backend/.env!");
    console.error("👉 Please generate keys from Razorpay Dashboard (Test Mode)");
    console.error("👉 Add them to backend/.env as RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
    console.error("👉 Restart the backend server for changes to take effect.\n");
}

// ✅ 2. Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ 3. Create Order
exports.createOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        // Validation
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ error: "Razorpay keys missing in server configuration. Check console logs." });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "Invalid amount. Must be greater than 0." });
        }

        // Razorpay expects amount in paise (1 INR = 100 paise)
        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        };

        console.log("Creating Razorpay Order with options:", options);

        const order = await razorpay.orders.create(options);

        console.log("✅ Razorpay Order Created:", order.id);

        res.json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID, // Send key_id to frontend
        });

    } catch (error) {
        console.error("❌ Order Creation Error details:");
        console.error("Status:", error.statusCode);
        console.error("Code:", error.error?.code);
        console.error("Description:", error.error?.description);

        // Return clear error to frontend
        res.status(error.statusCode || 500).json({
            error: error.error?.description || "Failed to create Razorpay order",
            details: error.error
        });
    }
};

// ✅ 4. Verify Payment & Recharge Wallet
exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.user.id; // From Auth Middleware

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: "Missing payment verification details" });
        }

        // Verify Signature using Native Crypto (HMAC SHA256)
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            console.error("❌ Invalid Signature");
            return res.status(400).json({ error: "Invalid payment signature. Potential fraud attempt." });
        }

        console.log("✅ Signature Verified. Processing Wallet Recharge...");

        // Fetch Order to ensure we credit the exact amount paid
        // Note: In production, you might want to check if this order was already processed to prevent double-spending
        const order = await razorpay.orders.fetch(razorpay_order_id);

        const amountInRupees = order.amount / 100;

        // Update User Wallet
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        user.wallet_balance += amountInRupees;
        await user.save();

        // Save Transaction with ENCRYPTED Reference
        const transaction = new Transaction({
            userId: user._id,
            type: "CREDIT",
            amount: amountInRupees,
            description: `Wallet recharge via Razorpay`,
            reference_id: encryptData(razorpay_payment_id) // Encrypting the Payment ID
        });
        await transaction.save();

        console.log(`✅ Wallet Recharged for ${user.name}: +₹${amountInRupees}`);

        res.json({
            success: true,
            message: "Payment verified & Wallet recharged",
            new_balance: user.wallet_balance,
        });

    } catch (error) {
        console.error("❌ Payment Verification Error:", error);
        res.status(500).json({ error: "Payment verification failed" });
    }
};
