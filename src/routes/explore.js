const express = require("express");
const router = express.Router();
const { getExploreData } = require("../controllers/exploreController");

// Public route - no authentication required
router.get("/", getExploreData);

module.exports = router; 