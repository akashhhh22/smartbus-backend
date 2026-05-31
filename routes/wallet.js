const express = require("express");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const router = express.Router();

/**
 * MOCK TOP-UP (UPI Simulation)
 */
router.post("/topup", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid request" });
    }

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0 });
    }

    wallet.balance += amount;
    await wallet.save();

    await Transaction.create({
      userId,
      type: "CREDIT",
      amount,
      description: "Mock UPI Top-Up"
    });

    res.json({
      status: "SUCCESS",
      balance: wallet.balance
    });
  } catch (err) {
    res.status(500).json({ message: "Top-up failed" });
  }
});

module.exports = router;
