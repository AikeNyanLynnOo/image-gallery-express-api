require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiResponse = require("../utils/apiResponse");
const { generateVerificationToken } = require("./verificationController");
const { sendVerificationEmail } = require("../services/emailService");

const signUp = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json(
        ApiResponse.error("Email already registered", {
          email: "This email is already in use",
        })
      );
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user
    const user = new User({
      email,
      password,
      verificationToken,
      verificationTokenExpires,
    });
    await user.save();

    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(201).json(
      ApiResponse.success(
        {
          user: {
            id: user._id,
            email: user.email,
            isVerified: user.isVerified,
          },
          token,
        },
        "User created successfully. Please check your email (including spam folder) for the verification link."
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Internal server error", {
        general: error.message,
      })
    );
  }
};

const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json(
        ApiResponse.error("Invalid credentials", {
          email: "No account found with this email",
        })
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json(
        ApiResponse.error("Invalid credentials", {
          password: "Incorrect password",
        })
      );
    }

    if (!user.isVerified) {
      return res.status(403).json(
        ApiResponse.error("Email not verified", {
          email: "Please verify your email before signing in",
        })
      );
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json(
      ApiResponse.success(
        {
          user: {
            id: user._id,
            email: user.email,
            isVerified: user.isVerified,
          },
          token,
        },
        "Sign in successful"
      )
    );
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Internal server error", {
        general: error.message,
      })
    );
  }
};

const logout = async (req, res) => {
  try {
    res.json(ApiResponse.success(null, "Logged out successfully"));
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Internal server error", {
        general: error.message,
      })
    );
  }
};

module.exports = {
  signUp,
  signIn,
  logout,
};
