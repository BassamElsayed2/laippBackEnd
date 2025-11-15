import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sql from "mssql";
import { pool } from "../config/database";
import { ApiError } from "../middleware/error.middleware";
import { validatePassword, normalizePhone } from "../utils/validation";
import { logSecurityEvent } from "../middleware/security.middleware";
import { Request } from "express";
import { GoogleAuthService } from "./google-auth.service";
import { FacebookAuthService } from "./facebook-auth.service";

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12");

interface SignUpData {
  email: string;
  password: string;
  full_name: string;
  phone: string;
}

interface SignInData {
  email: string;
  password: string;
}

export class AuthService {
  // Sign up new user
  static async signUp(data: SignUpData, req: Request) {
    const { email, password, full_name, phone } = data;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new ApiError(400, passwordValidation.errors.join(", "));
    }

    // Check if email already exists
    const emailCheck = await pool
      .request()
      .input("email", email.toLowerCase())
      .query("SELECT id FROM users WHERE email = @email");

    if (emailCheck.recordset.length > 0) {
      await logSecurityEvent("SIGNUP_FAILED", req, undefined, email, {
        reason: "Email already exists",
      });
      throw new ApiError(400, "Email already registered");
    }

    // Check if phone already exists
    const normalizedPhone = normalizePhone(phone);
    const phoneCheck = await pool
      .request()
      .input("phone", normalizedPhone)
      .query("SELECT id FROM profiles WHERE phone = @phone");

    if (phoneCheck.recordset.length > 0) {
      throw new ApiError(400, "Phone number already registered");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Start transaction
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      // Create user
      const userResult = await transaction
        .request()
        .input("email", email.toLowerCase())
        .input("passwordHash", passwordHash).query(`
          INSERT INTO users (email, password_hash, email_verified)
          OUTPUT INSERTED.id, INSERTED.email, INSERTED.created_at
          VALUES (@email, @passwordHash, 0)
        `);

      const user = userResult.recordset[0];

      // Create profile
      await transaction
        .request()
        .input("userId", user.id)
        .input("fullName", full_name)
        .input("phone", normalizedPhone).query(`
          INSERT INTO profiles (user_id, full_name, phone, phone_verified)
          VALUES (@userId, @fullName, @phone, 0)
        `);

      await transaction.commit();

      // Log success
      await logSecurityEvent("SIGNUP_SUCCESS", req, user.id, email);

      return {
        user: {
          id: user.id,
          email: user.email,
          full_name,
          phone: normalizedPhone,
        },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Sign in user
  static async signIn(data: SignInData, req: Request) {
    const { email, password } = data;

    // Check account lockout
    const lockoutCheck = await pool
      .request()
      .input("identifier", email.toLowerCase())
      .output("is_locked", sql.Bit)
      .output("locked_until", sql.DateTime2)
      .output("attempts_left", sql.Int)
      .execute("sp_CheckAccountLockout");

    if (lockoutCheck.output.is_locked) {
      throw new ApiError(
        423,
        `Account temporarily locked. Try again after ${new Date(
          lockoutCheck.output.locked_until
        ).toLocaleString()}`
      );
    }

    // Get user
    const userResult = await pool.request().input("email", email.toLowerCase())
      .query(`
        SELECT u.id, u.email, u.password_hash, u.email_verified,
               p.full_name, p.phone, p.phone_verified
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.email = @email
      `);

    if (userResult.recordset.length === 0) {
      // Record failed attempt
      await pool
        .request()
        .input("identifier", email.toLowerCase())
        .input("max_attempts", 5)
        .input("lockout_duration_minutes", 15)
        .output("is_locked", sql.Bit)
        .output("attempts_left", sql.Int)
        .output("locked_until", sql.DateTime2)
        .execute("sp_RecordFailedAttempt");

      await logSecurityEvent("LOGIN_FAILED", req, undefined, email, {
        reason: "User not found",
      });

      throw new ApiError(401, "Invalid email or password");
    }

    const user = userResult.recordset[0];

    // Check if user is admin and get role
    const adminCheck = await pool
      .request()
      .input("userId", user.id)
      .query("SELECT id, role FROM admin_profiles WHERE user_id = @userId");

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Record failed attempt
      await pool
        .request()
        .input("identifier", email.toLowerCase())
        .input("max_attempts", 5)
        .input("lockout_duration_minutes", 15)
        .output("is_locked", sql.Bit)
        .output("attempts_left", sql.Int)
        .output("locked_until", sql.DateTime2)
        .execute("sp_RecordFailedAttempt");

      await logSecurityEvent("LOGIN_FAILED", req, user.id, email, {
        reason: "Invalid password",
      });

      throw new ApiError(401, "Invalid email or password");
    }

    // Clear failed attempts
    await pool
      .request()
      .input("identifier", email.toLowerCase())
      .execute("sp_ClearFailedAttempts");

    // Determine user role
    const userRole =
      adminCheck.recordset.length > 0 ? adminCheck.recordset[0].role : "user";

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: userRole,
      },
      JWT_SECRET
    ) as string;

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await pool
      .request()
      .input("userId", user.id)
      .input("token", token)
      .input("deviceName", req.get("user-agent") || "Unknown")
      .input("ipAddress", req.ip)
      .input("expiresAt", expiresAt).query(`
        INSERT INTO sessions (user_id, token, device_name, ip_address, is_current, expires_at)
        VALUES (@userId, @token, @deviceName, @ipAddress, 1, @expiresAt)
      `);

    // Log success
    await logSecurityEvent("LOGIN_SUCCESS", req, user.id, email);

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        email_verified: user.email_verified,
        phone_verified: user.phone_verified,
        role: userRole,
      },
      token,
    };
  }

  // Sign out user
  static async signOut(userId: string, token: string, req: Request) {
    // Delete session
    await pool
      .request()
      .input("token", token)
      .query("DELETE FROM sessions WHERE token = @token");

    await logSecurityEvent("LOGOUT", req, userId);

    return { success: true };
  }

  // Get current user
  static async getCurrentUser(userId: string) {
    const result = await pool.request().input("userId", userId).query(`
        SELECT u.id, u.email, u.email_verified,
               p.full_name, p.phone, p.phone_verified, p.mfa_enabled,
               ap.role
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        LEFT JOIN admin_profiles ap ON u.id = ap.user_id
        WHERE u.id = @userId
      `);

    if (result.recordset.length === 0) {
      throw new ApiError(404, "User not found");
    }

    const user = result.recordset[0];

    return {
      ...user,
      role: user.role || "user",
    };
  }

  // Update profile
  static async updateProfile(
    userId: string,
    data: { full_name?: string; phone?: string }
  ) {
    const updates: string[] = [];
    const request = pool.request().input("userId", userId);

    if (data.full_name) {
      updates.push("full_name = @fullName");
      request.input("fullName", data.full_name);
    }

    if (data.phone) {
      const normalizedPhone = normalizePhone(data.phone);
      updates.push("phone = @phone, phone_verified = 0");
      request.input("phone", normalizedPhone);
    }

    if (updates.length === 0) {
      throw new ApiError(400, "No updates provided");
    }

    updates.push("updated_at = GETDATE()");

    await request.query(`
      UPDATE profiles
      SET ${updates.join(", ")}
      WHERE user_id = @userId
    `);

    return { success: true };
  }

  // Change password
  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    req: Request
  ) {
    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new ApiError(400, passwordValidation.errors.join(", "));
    }

    // Get current password hash
    const userResult = await pool
      .request()
      .input("userId", userId)
      .query("SELECT password_hash, email FROM users WHERE id = @userId");

    if (userResult.recordset.length === 0) {
      throw new ApiError(404, "User not found");
    }

    const user = userResult.recordset[0];

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      throw new ApiError(401, "Current password is incorrect");
    }

    // Check password history
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const historyCheck = await pool
      .request()
      .input("userId", userId)
      .input("passwordHash", newPasswordHash)
      .input("historyLimit", 5)
      .output("exists", sql.Bit)
      .execute("sp_CheckPasswordHistory");

    if (historyCheck.output.exists) {
      throw new ApiError(400, "Cannot reuse recent passwords");
    }

    // Update password
    await pool
      .request()
      .input("userId", userId)
      .input("passwordHash", newPasswordHash).query(`
        UPDATE users
        SET password_hash = @passwordHash, updated_at = GETDATE()
        WHERE id = @userId
      `);

    // Add to password history
    await pool
      .request()
      .input("userId", userId)
      .input("passwordHash", newPasswordHash)
      .input("maxHistory", 5)
      .execute("sp_AddPasswordToHistory");

    // Update profile
    await pool.request().input("userId", userId).query(`
        UPDATE profiles
        SET last_password_change = GETDATE()
        WHERE user_id = @userId
      `);

    // Invalidate all sessions except current
    await pool
      .request()
      .input("userId", userId)
      .query("DELETE FROM sessions WHERE user_id = @userId");

    await logSecurityEvent("PASSWORD_RESET_SUCCESS", req, userId, user.email);

    return { success: true };
  }

  // Check if phone exists
  static async checkPhoneExists(phone: string): Promise<boolean> {
    const normalizedPhone = normalizePhone(phone);
    const result = await pool.request().input("phone", normalizedPhone).query(`
        SELECT id FROM profiles
        WHERE phone = @phone
      `);

    return result.recordset.length > 0;
  }

  // Google Sign In
  static async googleSignIn(idToken: string, req: Request) {
    // Verify Google token and get user info
    const googleUser = await GoogleAuthService.verifyIdToken(idToken);

    // Check if user exists
    const userResult = await pool
      .request()
      .input("email", googleUser.email.toLowerCase()).query(`
        SELECT u.id, u.email, u.email_verified,
               p.full_name, p.phone, p.phone_verified
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.email = @email
      `);

    let user: any;
    let isNewUser = false;

    if (userResult.recordset.length === 0) {
      // Create new user from Google account
      const transaction = pool.transaction();
      await transaction.begin();

      try {
        // Create user without password (Google OAuth user)
        const newUserResult = await transaction
          .request()
          .input("email", googleUser.email.toLowerCase())
          .input("emailVerified", 1) // Google emails are pre-verified
          .query(`
            INSERT INTO users (email, email_verified)
            OUTPUT INSERTED.id, INSERTED.email, INSERTED.email_verified
            VALUES (@email, @emailVerified)
          `);

        user = newUserResult.recordset[0];

        // Create profile
        await transaction
          .request()
          .input("userId", user.id)
          .input("fullName", googleUser.name).query(`
            INSERT INTO profiles (user_id, full_name, phone_verified)
            VALUES (@userId, @fullName, 0)
          `);

        await transaction.commit();

        user.full_name = googleUser.name;
        user.phone = null;
        user.phone_verified = false;
        isNewUser = true;

        // Log signup
        await logSecurityEvent(
          "SIGNUP_SUCCESS",
          req,
          user.id,
          googleUser.email,
          {
            method: "google",
          }
        );
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } else {
      user = userResult.recordset[0];

      // If user exists but email wasn't verified, update it
      if (!user.email_verified) {
        await pool.request().input("userId", user.id).query(`
            UPDATE users
            SET email_verified = 1
            WHERE id = @userId
          `);
        user.email_verified = true;
      }
    }

    // Check if user is admin
    const adminCheck = await pool
      .request()
      .input("userId", user.id)
      .query("SELECT id, role FROM admin_profiles WHERE user_id = @userId");

    const userRole =
      adminCheck.recordset.length > 0 ? adminCheck.recordset[0].role : "user";

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: userRole,
      },
      JWT_SECRET
    ) as string;

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await pool
      .request()
      .input("userId", user.id)
      .input("token", token)
      .input("deviceName", req.get("user-agent") || "Unknown")
      .input("ipAddress", req.ip)
      .input("expiresAt", expiresAt).query(`
        INSERT INTO sessions (user_id, token, device_name, ip_address, is_current, expires_at)
        VALUES (@userId, @token, @deviceName, @ipAddress, 1, @expiresAt)
      `);

    // Log success
    await logSecurityEvent("LOGIN_SUCCESS", req, user.id, googleUser.email, {
      method: "google",
      isNewUser,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        email_verified: user.email_verified,
        phone_verified: user.phone_verified,
        role: userRole,
      },
      token,
      isNewUser,
    };
  }

  // Facebook Sign In
  static async facebookSignIn(accessToken: string, req: Request) {
    // Verify Facebook token and get user info
    const facebookUser = await FacebookAuthService.verifyAccessToken(
      accessToken
    );

    // Check if user exists
    const userResult = await pool
      .request()
      .input("email", facebookUser.email.toLowerCase()).query(`
        SELECT u.id, u.email, u.email_verified,
               p.full_name, p.phone, p.phone_verified
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.email = @email
      `);

    let user: any;
    let isNewUser = false;

    if (userResult.recordset.length === 0) {
      // Create new user from Facebook account
      const transaction = pool.transaction();
      await transaction.begin();

      try {
        // Create user without password (Facebook OAuth user)
        const newUserResult = await transaction
          .request()
          .input("email", facebookUser.email.toLowerCase())
          .input("emailVerified", 1) // Facebook emails are pre-verified
          .query(`
            INSERT INTO users (email, email_verified)
            OUTPUT INSERTED.id, INSERTED.email, INSERTED.email_verified
            VALUES (@email, @emailVerified)
          `);

        user = newUserResult.recordset[0];

        // Create profile
        await transaction
          .request()
          .input("userId", user.id)
          .input("fullName", facebookUser.name).query(`
            INSERT INTO profiles (user_id, full_name, phone_verified)
            VALUES (@userId, @fullName, 0)
          `);

        await transaction.commit();

        user.full_name = facebookUser.name;
        user.phone = null;
        user.phone_verified = false;
        isNewUser = true;

        // Log signup
        await logSecurityEvent(
          "SIGNUP_SUCCESS",
          req,
          user.id,
          facebookUser.email,
          {
            method: "facebook",
          }
        );
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } else {
      user = userResult.recordset[0];

      // If user exists but email wasn't verified, update it
      if (!user.email_verified) {
        await pool.request().input("userId", user.id).query(`
            UPDATE users
            SET email_verified = 1
            WHERE id = @userId
          `);
        user.email_verified = true;
      }
    }

    // Check if user is admin
    const adminCheck = await pool
      .request()
      .input("userId", user.id)
      .query("SELECT id, role FROM admin_profiles WHERE user_id = @userId");

    const userRole =
      adminCheck.recordset.length > 0 ? adminCheck.recordset[0].role : "user";

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: userRole,
      },
      JWT_SECRET
    ) as string;

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await pool
      .request()
      .input("userId", user.id)
      .input("token", token)
      .input("deviceName", req.get("user-agent") || "Unknown")
      .input("ipAddress", req.ip)
      .input("expiresAt", expiresAt).query(`
        INSERT INTO sessions (user_id, token, device_name, ip_address, is_current, expires_at)
        VALUES (@userId, @token, @deviceName, @ipAddress, 1, @expiresAt)
      `);

    // Log success
    await logSecurityEvent("LOGIN_SUCCESS", req, user.id, facebookUser.email, {
      method: "facebook",
      isNewUser,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        email_verified: user.email_verified,
        phone_verified: user.phone_verified,
        role: userRole,
      },
      token,
      isNewUser,
    };
  }
}
