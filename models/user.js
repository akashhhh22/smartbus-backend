const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            unique: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            // lowercase: true, // ❌ REMOVED: Corrupts encrypted data
            // trim: true, // ❌ REMOVED: Corrupts encrypted data
        },

        password: {
            type: String,
            required: true,
        },

        role: {
            type: String,
            enum: ["passenger", "conductor"],
            required: true,
        },

        // ✅ RFID UID (Encrypted)
        rfid_uid: {
            type: String,
            default: undefined, // ✅ DO NOT STORE NULL
        },

        // ✅ RFID Hash (Searchable)
        rfid_uid_hash: {
            type: String,
            unique: true,
            sparse: true,
            default: undefined, // ✅ FIX: undefined instead of null
        },

        wallet_balance: {
            type: Number,
            default: 0,
        },

        isBlocked: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
