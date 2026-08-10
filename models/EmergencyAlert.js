const mongoose = require("mongoose");

const emergencyAlertSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    location: {
        latitude: Number,
        longitude: Number
    },
    status: {
        type: String,
        enum: ["ACTIVE", "RESOLVED"],
        default: "ACTIVE"
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("EmergencyAlert", emergencyAlertSchema);
