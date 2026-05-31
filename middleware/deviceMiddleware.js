const dotenv = require("dotenv");
dotenv.config();

const verifyDevice = (req, res, next) => {
    const deviceKey = req.headers["x-device-key"];
    const validKey = process.env.ESP32_DEVICE_KEY;

    if (!deviceKey || deviceKey !== validKey) {
        console.log(`⚠️ Unauthorized Device Access Attempt. Key: ${deviceKey}`);
        return res.send("DEVICE_UNAUTHORIZED");
    }

    next();
};

module.exports = verifyDevice;
