const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const { decryptData } = require("./utils/encryption");
const User = require("./models/User");

const MONGO_URI = process.env.MONGO_URI;

const mongoOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
};

console.log("🔄 Connecting to MongoDB...");

mongoose
    .connect(MONGO_URI, mongoOptions)
    .then(async () => {
        console.log("✅ MongoDB Connected");
        
        const users = await User.find();
        console.log(`\n📊 Found ${users.length} users in database:\n`);
        
        users.forEach((user, index) => {
            console.log(`User ${index + 1}:`);
            console.log(`  ID: ${user._id}`);
            console.log(`  Name: ${user.name}`);
            console.log(`  Email (encrypted): ${user.email}`);
            console.log(`  Email (decrypted): ${decryptData(user.email)}`);
            console.log(`  Phone (encrypted): ${user.phone}`);
            console.log(`  Phone (decrypted): ${decryptData(user.phone)}`);
            console.log(`  Role: ${user.role}`);
            console.log(`  Wallet Balance: ${user.wallet_balance}`);
            console.log("");
        });
        
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ Error:", err.message);
        process.exit(1);
    });
