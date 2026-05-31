const express = require("express");
const router = express.Router();
const rfidController = require("../controllers/rfidController");
const verifyDevice = require("../middleware/deviceMiddleware");
const authMiddleware = require("../middleware/authMiddleware");

// Apply device verification middleware ONLY to scan route (or all if link needs it? No, Link is user action)
// The user said "backend/routes/rfidRoutes.js ... router.post('/link', authMiddleware, linkRFID)"
// BUT `router.use(verifyDevice)` is applied globally in the file right now (Line 7).
// This is a problem! `verifyDevice` expects `x-device-key`. The Frontend won't send that.
// I must move `router.use(verifyDevice)` to only apply to `/scan` OR make `/link` bypass it.
// The best way is to apply `verifyDevice` specifically to `/scan`.

// Define scan route (Device Protected)
router.post("/scan", verifyDevice, rfidController.scanRFID);

// Define link route (User Authenticated)
router.post("/link", authMiddleware, rfidController.linkRFID);

// Define auto-link scan route
router.post("/link-scan", authMiddleware, rfidController.linkRFIDByScan);

module.exports = router;
