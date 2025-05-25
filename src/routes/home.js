const express = require("express");
const router = express.Router();
const { getHomeData } = require("../controllers/homeController");

// Public route - no authentication required
router.get("/", getHomeData);

module.exports = router; 