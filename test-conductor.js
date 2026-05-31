const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";

const conductorData = {
    name: "Test Conductor",
    email: "conductor@test.com",
    password: "password123",
    phone: "1234567890",
    role: "conductor"
};

async function test() {
    console.log("📝 Step 1: Registering conductor...");
    try {
        const signupRes = await axios.post(`${BASE_URL}/auth/signup`, conductorData);
        console.log("✅ Signup response:", JSON.stringify(signupRes.data, null, 2));
    } catch (error) {
        console.error("❌ Signup failed:", error.response?.data || error.message);
        return;
    }

    console.log("\n🔐 Step 2: Logging in conductor...");
    try {
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: conductorData.email,
            password: conductorData.password
        });
        console.log("✅ Login response:", JSON.stringify(loginRes.data, null, 2));
    } catch (error) {
        console.error("❌ Login failed:", error.response?.data || error.message);
        console.error("Full error:", error.response?.status, error.response?.statusText);
    }
}

test();
