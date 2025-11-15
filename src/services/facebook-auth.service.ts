import { ApiError } from "../middleware/error.middleware";

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
  console.warn(
    "Warning: FACEBOOK_APP_ID or FACEBOOK_APP_SECRET is not set. Facebook authentication will not work."
  );
}

export interface FacebookUserInfo {
  id: string; // Facebook user ID
  email: string;
  name: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface FacebookAppTokenResponse {
  access_token: string;
  token_type: string;
}

interface FacebookDebugTokenResponse {
  data: {
    app_id: string;
    type: string;
    application: string;
    data_access_expires_at: number;
    expires_at: number;
    is_valid: boolean;
    scopes: string[];
    user_id: string;
  };
}

export class FacebookAuthService {
  /**
   * Verify Facebook access token and get user information
   */
  static async verifyAccessToken(
    accessToken: string
  ): Promise<FacebookUserInfo> {
    try {
      if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        throw new ApiError(500, "Facebook authentication is not configured");
      }

      // Verify that the access token belongs to our app
      const appTokenResponse = await fetch(
        `https://graph.facebook.com/oauth/access_token?client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&grant_type=client_credentials`
      );

      if (!appTokenResponse.ok) {
        throw new ApiError(401, "Failed to verify Facebook token");
      }

      const appTokenData =
        (await appTokenResponse.json()) as FacebookAppTokenResponse;
      const appAccessToken = appTokenData.access_token;

      // Inspect the user access token to verify it's valid and belongs to our app
      const inspectResponse = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appAccessToken}`
      );

      if (!inspectResponse.ok) {
        throw new ApiError(401, "Invalid Facebook access token");
      }

      const inspectData =
        (await inspectResponse.json()) as FacebookDebugTokenResponse;

      if (!inspectData.data || !inspectData.data.is_valid) {
        throw new ApiError(401, "Invalid Facebook access token");
      }

      if (inspectData.data.app_id !== FACEBOOK_APP_ID) {
        throw new ApiError(401, "Access token does not belong to this app");
      }

      // Get user information from Facebook Graph API
      const userResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
      );

      if (!userResponse.ok) {
        throw new ApiError(
          401,
          "Failed to fetch user information from Facebook"
        );
      }

      const userData = (await userResponse.json()) as FacebookUserInfo;

      // Verify email is present
      if (!userData.email) {
        throw new ApiError(
          400,
          "Email permission not granted. Please allow email access to continue."
        );
      }

      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
      };
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }

      console.error("Facebook token verification error:", error);
      throw new ApiError(401, "Invalid Facebook access token");
    }
  }
}
