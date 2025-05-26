const express = require("express");
const router = express.Router();
const { getHomeData, searchAutocomplete } = require("../controllers/homeController");

// Public route - no authentication required
router.get("/", getHomeData);
router.get("/search", searchAutocomplete);

module.exports = router; 