require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const imageRoutes = require("./routes/images");
const verificationRoutes = require("./routes/verification");
const collectionRoutes = require("./routes/collections");
const topicRoutes = require("./routes/topics");
const profileRoutes = require("./routes/profile");
const homeRoutes = require("./routes/home");
const exploreRoutes = require("./routes/explore");

const app = express();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(cors());
app.use(express.json());

// Health check route
app.get("/health", (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: Date.now(),
    time: new Date().toLocaleString(),
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  };

  try {
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = error;
    res.status(503).json(healthcheck);
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/verify", verificationRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/explore", exploreRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
