const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for development
        methods: ["GET", "POST"]
    },
    allowEIO3: true,          // Support ESP32 SocketIOclient (EIO3 + EIO4)
    pingTimeout: 60000,       // 60s before considering client dead
    pingInterval: 25000,      // Ping every 25s to keep connection alive
    transports: ["websocket", "polling"],
});

// Export io to be used in routes
app.set("io", io);

/* ---------------- SECURITY MIDDLEWARE ---------------- */
// 1. Helmet for secure headers
app.use(helmet());
app.disable("x-powered-by"); // Extra safety

// 2. HTTPS Redirect (Production Only)
if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
        if (req.headers["x-forwarded-proto"] !== "https") {
            return res.redirect(`https://${req.headers.host}${req.url}`);
        }
        next();
    });
}

// 3. Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting to critical routes
app.use("/api/auth", limiter);
app.use("/api/payment", limiter);

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors()); // Configure strict CORS if needed, default is * which is ok for dev
app.use(express.json());

/* ---------------- ROUTES ---------------- */
const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const rfidRoutes = require("./routes/rfidRoutes");
const passengerRoutes = require("./routes/passenger");
const conductorRoutes = require("./routes/conductor");
const paymentRoutes = require("./routes/payment");

/* ---------------- ROUTE MAPPING ---------------- */
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/rfid", rfidRoutes);
app.use("/api/passenger", passengerRoutes);
app.use("/api/conductor", conductorRoutes);
app.use("/api/payment", paymentRoutes);

/* ---------------- ROOT TEST ---------------- */
app.get("/", (req, res) => {
    res.send("🚍 Smart Bus Pass Backend is running");
});

/* ---------------- MONGODB CONNECTION ---------------- */
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// MongoDB connection options to fix SSL/TLS issues
const mongoOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4, skip trying IPv6
};

console.log("🔄 Attempting to connect to MongoDB...");

mongoose
    .connect(MONGO_URI, mongoOptions)
    .then(() => {
        console.log("✅ MongoDB Connected Successfully");
        // Use server.listen instead of app.listen
        server.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB Connection Error:", err.message);
        console.error("\n💡 Troubleshooting tips:");
        console.error("1. Check if your MongoDB connection string is correct in .env");
        console.error("2. Ensure your IP address is whitelisted in MongoDB Atlas");
        console.error("3. Verify your MongoDB username and password are correct");
        console.error("4. Make sure special characters in password are URL-encoded");
        console.error("\nFull error details:");
        console.error(err);
        process.exit(1);
    });


/* ---------------- ERROR HANDLER (SAFETY) ---------------- */
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Internal Server Error" });
});

/* ---------------- SOCKET.IO EVENTS ---------------- */
const User = require("./models/User");
const Wallet = require("./models/Wallet");
const { hashData } = require("./utils/encryption");

io.on("connection", (socket) => {
    console.log("🔌 New client connected:", socket.id);

    // ── ESP32 DEVICE REGISTRATION ──
    socket.on("esp32_register", (data) => {
        const validKey = process.env.ESP32_DEVICE_KEY || "BUSPASS_ESP32_KEY_2026";
        if (data && data.deviceKey === validKey) {
            socket.join("esp32_scanners");
            socket.esp32 = true;
            console.log("🟢 ESP32 registered & joined esp32_scanners room:", socket.id);
            socket.emit("register_ack", { success: true, message: "ESP32 registered" });
            // Notify dashboards that ESP32 is online
            io.to("conductor_dashboards").emit("esp32_status", { connected: true });
        } else {
            console.log("⚠️ ESP32 registration failed — invalid device key:", socket.id);
            socket.emit("register_ack", { success: false, message: "Invalid device key" });
        }
    });

    // ── CONDUCTOR DASHBOARD REGISTRATION ──
    socket.on("dashboard_register", () => {
        socket.join("conductor_dashboards");
        socket.dashboard = true;
        console.log("🟢 Dashboard joined conductor_dashboards room:", socket.id);
        // Check if any ESP32 is currently connected
        const esp32Room = io.sockets.adapter.rooms.get("esp32_scanners");
        const esp32Connected = esp32Room ? esp32Room.size > 0 : false;
        socket.emit("esp32_status", { connected: esp32Connected });
    });

    // ── NEW CARD DETECTED (from ESP32) ──
    socket.on("new_card_detected", async (data) => {
        if (!socket.esp32) {
            console.log("⚠️ new_card_detected from non-ESP32 socket, ignoring:", socket.id);
            return;
        }

        const uid = data && data.uid;
        if (!uid) {
            console.log("⚠️ new_card_detected with no UID");
            return;
        }

        console.log("📡 Card detected from ESP32:", uid);

        try {
            // Look up passenger by hashed RFID UID
            const hashedUid = hashData(uid);
            const passenger = await User.findOne({ rfid_uid_hash: hashedUid }).select("-password");

            if (!passenger) {
                console.log("❌ Passenger not found for UID:", uid);
                io.to("conductor_dashboards").emit("scan_error", {
                    uid,
                    error: "Passenger not found. Card not linked."
                });
                // Tell ESP32 to show error
                socket.emit("scan_result", { success: false, message: "NOT FOUND" });
                return;
            }

            // Get wallet balance (source of truth)
            const wallet = await Wallet.findOne({ userId: passenger._id });
            const balance = wallet ? wallet.balance : (passenger.wallet_balance || 0);

            console.log(`✅ Passenger found: ${passenger.name}, Balance: ₹${balance}`);

            // Relay to all conductor dashboards
            io.to("conductor_dashboards").emit("new_scan", {
                uid,
                passenger: {
                    name: passenger.name,
                    wallet_balance: balance,
                    rfid_linked: true
                }
            });

            // Tell ESP32 to show success on LCD
            socket.emit("scan_result", {
                success: true,
                message: "FOUND",
                name: passenger.name,
                balance: balance
            });
        } catch (err) {
            console.error("❌ Error looking up passenger from card scan:", err);
            io.to("conductor_dashboards").emit("scan_error", {
                uid,
                error: "Server error during lookup"
            });
            socket.emit("scan_result", { success: false, message: "ERROR" });
        }
    });

    // ── DISCONNECT ──
    socket.on("disconnect", () => {
        if (socket.esp32) {
            console.log("❌ ESP32 disconnected:", socket.id);
            io.to("conductor_dashboards").emit("esp32_status", { connected: false });
        } else if (socket.dashboard) {
            console.log("❌ Dashboard disconnected:", socket.id);
        } else {
            console.log("❌ Client disconnected:", socket.id);
        }
    });
});
