require("dotenv").config();
const { google } = require("googleapis");
const readline = require("readline");

// First, let's verify the environment variables are loaded
console.log("Checking environment variables:");
console.log("GMAIL_CLIENT_ID:", process.env.GMAIL_CLIENT_ID ? "✓ Set" : "✗ Not set");
console.log("GMAIL_CLIENT_SECRET:", process.env.GMAIL_CLIENT_SECRET ? "✓ Set" : "✗ Not set");
console.log("BACKEND_REDIRECT_URI:", process.env.BACKEND_REDIRECT_URI ? "✓ Set" : "✗ Not set");

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.BACKEND_REDIRECT_URI // This should match your redirect URI
);

const SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.send",
];

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
});

console.log("Authorize this app by visiting this url:", url);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the code from that page here: ", (code) => {
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) {
      console.error("Error getting tokens:", err);
      return;
    }
    console.log("Refresh token:", tokens.refresh_token);
    rl.close();
  });
});
