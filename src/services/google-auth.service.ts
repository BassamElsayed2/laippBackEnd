import { OAuth2Client } from "google-auth-library";
import { ApiError } from "../middleware/error.middleware";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.warn(
    "Warning: GOOGLE_CLIENT_ID is not set. Google authentication will not work."
  );
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface GoogleUserInfo {
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  sub: string; // Google user ID
}

export class GoogleAuthService {
  /**
   * Verify Google ID token and extract user information
   */
  static async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      if (!GOOGLE_CLIENT_ID) {
        throw new ApiError(500, "Google authentication is not configured");
      }

      const ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new ApiError(401, "Invalid Google token");
      }

      // Verify email is present and verified
      if (!payload.email) {
        throw new ApiError(400, "Email not provided by Google");
      }

      if (!payload.email_verified) {
        throw new ApiError(400, "Google email is not verified");
      }

      return {
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name || "",
        picture: payload.picture,
        sub: payload.sub,
      };
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }

      console.error("Google token verification error:", error);
      throw new ApiError(401, "Invalid Google token");
    }
  }
}
