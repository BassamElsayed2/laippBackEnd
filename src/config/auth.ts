import dotenv from "dotenv";

dotenv.config();

// Auth Configuration
export const AUTH_CONFIG = {
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieName: "food_cms_session",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12"),
  },
  accountLockout: {
    maxAttempts: 5,
    lockoutDuration: 15, // minutes
  },
  passwordHistory: {
    count: 5, // Remember last 5 passwords
  },
};
