import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getPool } from "../config/database";
import { AuthRequest, User, Profile } from "../types";
import { ApiError } from "../middleware/errorHandler";
import { generateToken } from "../middleware/auth";

/**
 * Register a new user
 */
export const register = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, name, first_name, last_name, phone } = req.body;

    const pool = getPool();

    // Check if email already exists
    const existingUser = await pool
      .request()
      .input("email", email)
      .query("SELECT id FROM users WHERE email = @email");

    if (existingUser.recordset.length > 0) {
      throw new ApiError(400, "Email already registered");
    }

    // Check if phone already exists (if provided)
    if (phone) {
      const existingPhone = await pool
        .request()
        .input("phone", phone)
        .query("SELECT user_id FROM profiles WHERE phone = @phone");

      if (existingPhone.recordset.length > 0) {
        throw new ApiError(400, "Phone number already registered");
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    await pool
      .request()
      .input("id", userId)
      .input("email", email)
      .input("name", name || null)
      .input("role", "user").query(`
        INSERT INTO users (id, email, name, role, email_verified)
        VALUES (@id, @email, @name, @role, 0)
      `);

    // Create account (password)
    const accountId = uuidv4();
    await pool
      .request()
      .input("id", accountId)
      .input("user_id", userId)
      .input("account_type", "email")
      .input("password_hash", passwordHash).query(`
        INSERT INTO accounts (id, user_id, account_type, password_hash)
        VALUES (@id, @user_id, @account_type, @password_hash)
      `);

    // Create profile
    const profileId = uuidv4();
    const fullName =
      name ||
      (first_name && last_name
        ? `${first_name} ${last_name}`
        : first_name || last_name || null);

    await pool
      .request()
      .input("id", profileId)
      .input("user_id", userId)
      .input("full_name", fullName)
      .input("phone", phone || null).query(`
        INSERT INTO profiles (id, user_id, full_name, phone)
        VALUES (@id, @user_id, @full_name, @phone)
      `);

    // Get created user with profile data
    const userResult = await pool.request().input("userId", userId).query(`
        SELECT u.id, u.email, u.email_verified, u.name, u.role,
               u.created_at, u.updated_at,
               p.full_name, p.phone, p.avatar_url
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.id = @userId
      `);

    const user = userResult.recordset[0];

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
      message: "User registered successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user (with email or phone)
 */
export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body; // "email" field can contain email OR phone

    const pool = getPool();

    // Determine if login is with email or phone
    const isEmail = email.includes("@");

    let result;

    if (isEmail) {
      // Login with email
      result = await pool.request().input("email", email).query(`
          SELECT u.id, u.email, u.email_verified, u.name, u.role, 
                 u.created_at, u.updated_at, a.password_hash,
                 p.full_name, p.phone, p.avatar_url
          FROM users u
          INNER JOIN accounts a ON u.id = a.user_id
          LEFT JOIN profiles p ON u.id = p.user_id
          WHERE u.email = @email AND a.account_type = 'email'
        `);
    } else {
      // Login with phone - join with profiles table
      result = await pool.request().input("phone", email) // Using 'email' parameter but it contains phone
        .query(`
          SELECT u.id, u.email, u.email_verified, u.name, u.role, 
                 u.created_at, u.updated_at, a.password_hash,
                 p.full_name, p.phone, p.avatar_url
          FROM users u
          INNER JOIN profiles p ON u.id = p.user_id
          INNER JOIN accounts a ON u.id = a.user_id
          WHERE p.phone = @phone AND a.account_type = 'email'
        `);
    }

    if (result.recordset.length === 0) {
      // User not found - give specific error message
      if (isEmail) {
        throw new ApiError(401, "No account found with this email address");
      } else {
        throw new ApiError(401, "No account found with this phone number");
      }
    }

    const userData = result.recordset[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      userData.password_hash
    );

    if (!isPasswordValid) {
      throw new ApiError(401, "Incorrect password. Please try again");
    }

    // Remove password hash from user object
    const { password_hash, ...user } = userData;

    // Generate token
    const token = generateToken(user as User);

    res.json({
      success: true,
      data: {
        user,
        token,
      },
      message: "Login successful",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 */
export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const pool = getPool();

    // Get user with profile (admin_profiles for admins, profiles for customers)
    const profileTable =
      req.user.role === "admin" ? "admin_profiles" : "profiles";

    // Select different columns based on profile type
    const profileColumns =
      req.user.role === "admin"
        ? "p.full_name, p.phone, p.avatar_url, p.job_title, p.address, p.about"
        : "p.full_name, p.phone, p.avatar_url";

    const result = await pool.request().input("userId", req.user.id).query(`
        SELECT u.id, u.email, u.email_verified, u.name, u.role,
               u.created_at, u.updated_at,
               ${profileColumns},
               p.user_id as profile_user_id
        FROM users u
        LEFT JOIN ${profileTable} p ON u.id = p.user_id
        WHERE u.id = @userId
      `);

    if (result.recordset.length === 0) {
      console.error(`[getMe] User ${req.user.id} not found in database`);
      throw new ApiError(404, "User not found");
    }

    const userData = result.recordset[0];

    res.json({
      success: true,
      data: userData,
    });
  } catch (error: any) {
    console.error("[getMe] Error:", error.message);
    next(error);
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const { full_name, phone, avatar_url, job_title, address, about } =
      req.body;
    const pool = getPool();

    // Use admin_profiles for admins, profiles for customers
    const profileTable =
      req.user.role === "admin" ? "admin_profiles" : "profiles";

    console.log(
      `[updateProfile] Updating profile for user ${req.user.id} in ${profileTable}`,
      {
        full_name,
        phone,
      }
    );

    // Check if profile exists
    const checkProfile = await pool.request().input("user_id", req.user.id)
      .query(`
        SELECT id FROM ${profileTable} WHERE user_id = @user_id
      `);

    if (checkProfile.recordset.length === 0) {
      // Create profile if it doesn't exist
      console.log(
        `[updateProfile] Creating new profile for user ${req.user.id}`
      );
      const profileId = uuidv4();

      if (req.user.role === "admin") {
        // Admin profile with all columns
        await pool
          .request()
          .input("id", profileId)
          .input("user_id", req.user.id)
          .input("full_name", full_name || null)
          .input("phone", phone || null)
          .input("avatar_url", avatar_url || null)
          .input("job_title", job_title || null)
          .input("address", address || null)
          .input("about", about || null).query(`
            INSERT INTO ${profileTable} (id, user_id, full_name, phone, avatar_url, job_title, address, about, created_at, updated_at)
            VALUES (@id, @user_id, @full_name, @phone, @avatar_url, @job_title, @address, @about, GETDATE(), GETDATE())
          `);
      } else {
        // Customer profile (no job_title, address, about)
        await pool
          .request()
          .input("id", profileId)
          .input("user_id", req.user.id)
          .input("full_name", full_name || null)
          .input("phone", phone || null)
          .input("avatar_url", avatar_url || null).query(`
            INSERT INTO ${profileTable} (id, user_id, full_name, phone, avatar_url, created_at, updated_at)
            VALUES (@id, @user_id, @full_name, @phone, @avatar_url, GETDATE(), GETDATE())
          `);
      }
      console.log(`[updateProfile] Profile created successfully`);
    } else {
      // Update existing profile
      console.log(
        `[updateProfile] Updating existing profile for user ${req.user.id}`
      );

      if (req.user.role === "admin") {
        // Admin profile with all columns
        await pool
          .request()
          .input("user_id", req.user.id)
          .input("full_name", full_name || null)
          .input("phone", phone || null)
          .input("avatar_url", avatar_url || null)
          .input("job_title", job_title || null)
          .input("address", address || null)
          .input("about", about || null).query(`
            UPDATE ${profileTable}
            SET full_name = @full_name,
                phone = @phone,
                avatar_url = @avatar_url,
                job_title = @job_title,
                address = @address,
                about = @about,
                updated_at = GETDATE()
            WHERE user_id = @user_id
          `);
      } else {
        // Customer profile (no job_title, address, about)
        await pool
          .request()
          .input("user_id", req.user.id)
          .input("full_name", full_name || null)
          .input("phone", phone || null)
          .input("avatar_url", avatar_url || null).query(`
            UPDATE ${profileTable}
            SET full_name = @full_name,
                phone = @phone,
                avatar_url = @avatar_url,
                updated_at = GETDATE()
            WHERE user_id = @user_id
          `);
      }
      console.log(`[updateProfile] Profile updated successfully`);
    }

    // Get updated profile
    const profileColumns =
      req.user.role === "admin"
        ? "p.full_name, p.phone, p.avatar_url, p.job_title, p.address, p.about"
        : "p.full_name, p.phone, p.avatar_url";

    const result = await pool.request().input("userId", req.user.id).query(`
        SELECT u.id, u.email, u.email_verified, u.name, u.role,
               u.created_at, u.updated_at,
               ${profileColumns},
               p.user_id as profile_user_id
        FROM users u
        LEFT JOIN ${profileTable} p ON u.id = p.user_id
        WHERE u.id = @userId
      `);

    console.log(`[updateProfile] Returning updated data:`, {
      full_name: result.recordset[0].full_name,
      phone: result.recordset[0].phone,
    });

    res.json({
      success: true,
      data: result.recordset[0],
      message: "Profile updated successfully",
    });
  } catch (error: any) {
    console.error("[updateProfile] Error:", error.message);
    next(error);
  }
};

/**
 * Change password
 */
export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    const { currentPassword, newPassword } = req.body;

    const pool = getPool();

    // Get current password hash
    const accountResult = await pool.request().input("user_id", req.user.id)
      .query(`
        SELECT password_hash
        FROM accounts
        WHERE user_id = @user_id AND account_type = 'email'
      `);

    if (accountResult.recordset.length === 0) {
      throw new ApiError(404, "Account not found");
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      accountResult.recordset[0].password_hash
    );

    if (!isPasswordValid) {
      throw new ApiError(401, "Current password is incorrect");
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool
      .request()
      .input("user_id", req.user.id)
      .input("password_hash", newPasswordHash).query(`
        UPDATE accounts
        SET password_hash = @password_hash
        WHERE user_id = @user_id AND account_type = 'email'
      `);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if email is available
 */
export const checkEmailAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== "string") {
      throw new ApiError(400, "Email is required");
    }

    const pool = getPool();
    const result = await pool
      .request()
      .input("email", email)
      .query("SELECT id FROM users WHERE email = @email");

    const isAvailable = result.recordset.length === 0;

    res.json({
      success: true,
      data: {
        available: isAvailable,
        message: isAvailable
          ? "Email is available"
          : "Email already registered",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if phone number is available
 */
export const checkPhoneAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone } = req.query;

    if (!phone || typeof phone !== "string") {
      throw new ApiError(400, "Phone number is required");
    }

    const pool = getPool();
    const result = await pool
      .request()
      .input("phone", phone)
      .query("SELECT user_id FROM profiles WHERE phone = @phone");

    const isAvailable = result.recordset.length === 0;

    res.json({
      success: true,
      data: {
        available: isAvailable,
        message: isAvailable
          ? "Phone number is available"
          : "Phone number already registered",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout (client-side will remove token)
 */
export const logout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
