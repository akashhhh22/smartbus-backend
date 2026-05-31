const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

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
        
        // Clean all collections
        console.log("🗑️  Cleaning database...");
        
        await mongoose.connection.db.collection("users").deleteMany({});
        console.log("✅ Deleted all users");
        
        await mongoose.connection.db.collection("wallets").deleteMany({});
        console.log("✅ Deleted all wallets");
        
        await mongoose.connection.db.collection("transactions").deleteMany({});
        console.log("✅ Deleted all transactions");
        
        console.log("✅ Database cleaned successfully!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ Error:", err.message);
        process.exit(1);
    });
