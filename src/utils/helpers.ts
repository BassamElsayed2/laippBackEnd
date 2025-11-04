import crypto from 'crypto';

/**
 * Verify Easykash callback signature
 */
export function verifyEasykashSignature(
  payload: {
    ProductCode: string;
    Amount: string;
    ProductType: string;
    PaymentMethod: string;
    status: string;
    easykashRef: string;
    customerReference: string;
    signatureHash: string;
  },
  secretKey: string
): boolean {
  const {
    ProductCode,
    Amount,
    ProductType,
    PaymentMethod,
    status,
    easykashRef,
    customerReference,
    signatureHash,
  } = payload;

  // Prepare data for verification
  const dataToSecure = [
    ProductCode,
    Amount,
    ProductType,
    PaymentMethod,
    status,
    easykashRef,
    customerReference,
  ];

  const dataStr = dataToSecure.join('');

  // Generate HMAC SHA-512 hash for verification
  const calculatedSignature = crypto
    .createHmac('sha512', secretKey)
    .update(dataStr)
    .digest('hex');

  // Check if the calculated hash matches the received signatureHash
  return calculatedSignature === signatureHash;
}

/**
 * Parse JSON safely
 */
export function parseJSON<T = any>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return defaultValue;
  }
}

/**
 * Format SQL date to ISO string
 */
export function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  
  try {
    return new Date(date).toISOString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}

/**
 * Generate unique order reference
 */
export function generateOrderReference(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${randomStr}`.toUpperCase();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Egyptian phone number
 */
export function isValidEgyptianPhone(phone: string): boolean {
  // Egyptian phone: 01012345678 or +201012345678
  const phoneRegex = /^(\+?20)?0?1[0-2,5]{1}[0-9]{8}$/;
  return phoneRegex.test(phone);
}

/**
 * Sanitize string for SQL (basic protection)
 */
export function sanitizeString(str: string): string {
  return str.replace(/[<>]/g, '');
}

/**
 * Calculate pagination offset
 */
export function getPaginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Calculate total pages
 */
export function getTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

/**
 * Format price to 2 decimal places
 */
export function formatPrice(price: number): number {
  return Math.round(price * 100) / 100;
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash password using SHA-256
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Compare password with hash
 */
export function comparePassword(password: string, hash: string): boolean {
  const passwordHash = hashPassword(password);
  return passwordHash === hash;
}


