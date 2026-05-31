const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ["CREDIT", "DEBIT"],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: String,

    // Encrypted reference ID (e.g., Razorpay Payment ID or Order ID)
    reference_id: {
        type: String,
        default: null
    }

}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);
