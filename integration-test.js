const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const BASE_URL = "http://localhost:5000/api";

let conductorToken = null;
let passengerToken = null;
let passengerId = null;

// Test data
const conductorData = {
    name: "Test Conductor",
    email: "conductor@test.com",
    password: "password123",
    phone: "1234567890",
    role: "conductor"
};

const passengerData = {
    name: "Test Passenger",
    email: "passenger@test.com",
    password: "password123",
    phone: "9876543210",
    role: "passenger"
};

const rfidData = {
    uid: "ABCD1234"
};

async function registerConductor() {
    console.log("\n📝 Registering conductor...");
    try {
        const response = await axios.post(`${BASE_URL}/auth/signup`, conductorData);
        console.log("✅ Conductor registered:", response.data);
        return true;
    } catch (error) {
        console.error("❌ Conductor registration failed:", error.response?.data || error.message);
        return false;
    }
}

async function loginConductor() {
    console.log("\n🔐 Logging in conductor...");
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: conductorData.email,
            password: conductorData.password
        });
        conductorToken = response.data.token;
        console.log("✅ Conductor login successful");
        console.log("   Token:", conductorToken.substring(0, 20) + "...");
        console.log("   User:", response.data.user);
        return true;
    } catch (error) {
        console.error("❌ Conductor login failed:", error.response?.data || error.message);
        return false;
    }
}

async function registerPassenger() {
    console.log("\n📝 Registering passenger...");
    try {
        const response = await axios.post(`${BASE_URL}/auth/signup`, passengerData);
        passengerId = response.data.user?.id;
        console.log("✅ Passenger registered:", response.data);
        console.log("   Passenger ID:", passengerId);
        return true;
    } catch (error) {
        console.error("❌ Passenger registration failed:", error.response?.data || error.message);
        // If already registered, try to get ID from login
        if (error.response?.data?.error?.includes("already registered")) {
            console.log("   (User already exists, will get ID from login)");
            return true;
        }
        return false;
    }
}

async function loginPassenger() {
    console.log("\n🔐 Logging in passenger...");
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: passengerData.email,
            password: passengerData.password
        });
        passengerToken = response.data.token;
        passengerId = response.data.user.id; // Get ID from login if not set
        console.log("✅ Passenger login successful");
        console.log("   Token:", passengerToken.substring(0, 20) + "...");
        console.log("   User:", response.data.user);
        return true;
    } catch (error) {
        console.error("❌ Passenger login failed:", error.response?.data || error.message);
        return false;
    }
}

async function linkRFID() {
    console.log("\n🔗 Linking RFID card to passenger...");
    try {
        const response = await axios.post(
            `${BASE_URL}/rfid/link`,
            {
                userId: passengerId,
                uid: rfidData.uid
            },
            {
                headers: {
                    Authorization: `Bearer ${passengerToken}`
                }
            }
        );
        console.log("✅ RFID linked successfully:", response.data);
        return true;
    } catch (error) {
        console.error("❌ RFID linking failed:", error.response?.data || error.message);
        return false;
    }
}

async function topupWallet() {
    console.log("\n💰 Adding funds to passenger wallet...");
    try {
        const response = await axios.post(
            `${BASE_URL}/wallet/topup`,
            {
                userId: passengerId,
                amount: 100
            }
        );
        console.log("✅ Wallet topped up:", response.data);
        return true;
    } catch (error) {
        console.error("❌ Wallet topup failed:", error.response?.data || error.message);
        return false;
    }
}

async function scanRFID() {
    console.log("\n📡 Scanning RFID card...");
    try {
        const response = await axios.post(
            `${BASE_URL}/rfid/scan`,
            {
                uid: rfidData.uid
            },
            {
                headers: {
                    "x-device-key": process.env.ESP32_DEVICE_KEY || "BUSPASS_ESP32_KEY_2026"
                }
            }
        );
        console.log("✅ RFID scan successful:", response.data);
        return true;
    } catch (error) {
        console.error("❌ RFID scan failed:", error.response?.data || error.message);
        return false;
    }
}

async function testMeEndpoint(role, token) {
    console.log(`\n👤 Testing /me endpoint for ${role}...`);
    try {
        const response = await axios.get(`${BASE_URL}/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log(`✅ /me endpoint successful for ${role}:`, response.data);
        return true;
    } catch (error) {
        console.error(`❌ /me endpoint failed for ${role}:`, error.response?.data || error.message);
        return false;
    }
}

async function runIntegrationTests() {
    console.log("🚀 Starting Integration Tests...");
    console.log("=" .repeat(50));
    
    let allPassed = true;
    
    // Test 7.2: Register and login conductor
    if (!await registerConductor()) allPassed = false;
    if (!await loginConductor()) allPassed = false;
    
    // Test 7.3: Register and login passenger
    if (!await registerPassenger()) allPassed = false;
    if (!await loginPassenger()) allPassed = false;
    
    // Test 7.4: Link RFID card
    if (!await linkRFID()) allPassed = false;
    
    // Add funds to wallet before scanning
    if (!await topupWallet()) allPassed = false;
    
    // Test 7.5: Scan RFID card
    if (!await scanRFID()) allPassed = false;
    
    // Test 7.7: Test /me endpoint for both users
    if (!await testMeEndpoint("conductor", conductorToken)) allPassed = false;
    if (!await testMeEndpoint("passenger", passengerToken)) allPassed = false;
    
    console.log("\n" + "=".repeat(50));
    if (allPassed) {
        console.log("✅ ALL INTEGRATION TESTS PASSED!");
    } else {
        console.log("❌ SOME TESTS FAILED - Check logs above");
    }
    console.log("=".repeat(50));
}

// Run tests
runIntegrationTests().catch(err => {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
});
