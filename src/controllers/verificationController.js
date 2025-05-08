const crypto = require("crypto");
const User = require("../models/User");
const { sendVerificationEmail } = require("../services/emailService");
const ApiResponse = require("../utils/apiResponse");

const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const sendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json(ApiResponse.error("User not found"));
    }

    if (user.isVerified) {
      return res.status(400).json(ApiResponse.error("Email already verified"));
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();

    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    res.json(ApiResponse.success(null, "Verification email sent successfully"));
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to send verification email", {
        general: error.message,
      })
    );
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json(ApiResponse.error("Invalid or expired verification token"));
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.json(ApiResponse.success(null, "Email verified successfully"));
  } catch (error) {
    res.status(500).json(
      ApiResponse.error("Failed to verify email", {
        general: error.message,
      })
    );
  }
};

module.exports = {
  sendVerification,
  verifyEmail,
  generateVerificationToken,
};
