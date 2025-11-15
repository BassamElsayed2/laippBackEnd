import dotenv from "dotenv";

dotenv.config();

// OTP Configuration - DISABLED FOR NOW
// Will be enabled when Twilio credentials are configured

export const OTP_CONFIG = {
  enabled: false, // Set to true when ready to use OTP
  length: 6,
  expiryMinutes: 10,
  maxAttempts: 3,
  resendCooldown: 60, // seconds
};

// Placeholder functions - will be implemented when OTP is enabled
export function generateOTP(length: number = 6): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

// Mock function - returns success for development
export async function sendOTPviaSMS(
  phone: string,
  code: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!OTP_CONFIG.enabled) {
    console.log(`[OTP DISABLED] Would send OTP ${code} to ${phone}`);
    return {
      success: true,
      messageId: "mock-message-id",
    };
  }

  // When enabled, implement Twilio integration here
  return {
    success: false,
    error: "OTP service not configured",
  };
}

// Mock function - returns success for development
export async function verifyOTPviaSMS(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!OTP_CONFIG.enabled) {
    console.log(`[OTP DISABLED] Would verify OTP ${code} for ${phone}`);
    return { success: true };
  }

  // When enabled, implement Twilio verification here
  return {
    success: false,
    error: "OTP service not configured",
  };
}
