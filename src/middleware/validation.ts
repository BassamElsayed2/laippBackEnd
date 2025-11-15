import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { ApiError } from "./errorHandler";

/**
 * Validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return next(new ApiError(400, errorMessage));
    }

    next();
  };
};

// =====================================================
// Validation Schemas
// =====================================================

// Custom password validator (strong password)
const strongPasswordValidator = Joi.string()
  .min(8)
  .pattern(new RegExp("(?=.*[a-z])")) // At least one lowercase
  .pattern(new RegExp("(?=.*[A-Z])")) // At least one uppercase
  .pattern(new RegExp("(?=.*[0-9])")) // At least one number
  .pattern(new RegExp('(?=.*[!@#$%^&*(),.?":{}|<>])')) // At least one special char
  .required()
  .messages({
    "string.min": "Password must be at least 8 characters long",
    "string.pattern.base":
      "Password must contain uppercase, lowercase, number, and special character",
    "any.required": "Password is required",
  });

// Egyptian phone validator
const egyptianPhoneValidator = Joi.string()
  .pattern(/^(01[0125]\d{8}|(\+20|0020)01[0125]\d{8})$/)
  .messages({
    "string.pattern.base":
      "Please provide a valid Egyptian phone number (01xxxxxxxxx)",
  });

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: strongPasswordValidator,
  name: Joi.string().optional(),
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
  phone: egyptianPhoneValidator.optional().allow("", null),
});

export const loginSchema = Joi.object({
  email: Joi.string().required().messages({
    "any.required": "Email or phone number is required",
  }), // Can be email or phone
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: strongPasswordValidator,
});

export const updateProfileSchema = Joi.object({
  full_name: Joi.string().optional().allow("", null),
  phone: Joi.string().optional().allow("", null),
  avatar_url: Joi.string().uri().optional().allow("", null),
  job_title: Joi.string().optional().allow("", null),
  address: Joi.string().optional().allow("", null),
  about: Joi.string().optional().allow("", null),
});

export const createProductSchema = Joi.object({
  title: Joi.string().optional(), // Made optional
  name_ar: Joi.string().required(), // Now required
  name_en: Joi.string().required(), // Now required
  description_ar: Joi.string().optional(),
  description_en: Joi.string().optional(),
  price: Joi.number().positive().required(),
  offer_price: Joi.number().positive().optional(),
  images: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  category_id: Joi.number().optional(),
  stock_quantity: Joi.number().integer().min(0).default(0),
  is_best_seller: Joi.boolean().default(false),
  limited_time_offer: Joi.boolean().default(false),
  attributes: Joi.array()
    .items(
      Joi.object({
        attribute_name: Joi.string().required(),
        attribute_value: Joi.string().required(),
      })
    )
    .optional(),
});

export const createOrderSchema = Joi.object({
  user_id: Joi.string().uuid().optional().allow(null),
  total_price: Joi.number().positive().required(),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.string().uuid().required(),
        quantity: Joi.number().integer().positive().required(),
        price: Joi.number().positive().required(),
      })
    )
    .min(1)
    .required(),
  payment_method: Joi.string().valid("easykash", "cod").required(),
  notes: Joi.string().optional(),
  customer_first_name: Joi.string().required(),
  customer_last_name: Joi.string().required(),
  customer_phone: Joi.string().required(),
  customer_email: Joi.string().email().optional().allow("", null),
  customer_street_address: Joi.string().required(),
  customer_city: Joi.string().required(),
  customer_state: Joi.string().optional(),
  customer_postcode: Joi.string().optional(),
});

export const createCategorySchema = Joi.object({
  name_ar: Joi.string().required(),
  name_en: Joi.string().required(),
  image_url: Joi.string().uri().optional(),
});

export const createBannerSchema = Joi.object({
  desc_ar: Joi.string().optional(),
  desc_en: Joi.string().optional(),
  image: Joi.string().uri().optional(),
  display_order: Joi.number().integer().default(0),
  is_active: Joi.boolean().default(true),
});

export const createBlogSchema = Joi.object({
  title_ar: Joi.string().optional(),
  title_en: Joi.string().optional(),
  content_ar: Joi.string().optional(),
  content_en: Joi.string().optional(),
  images: Joi.array().items(Joi.string().uri()).optional(),
  yt_code: Joi.string().optional().allow("", null),
  author: Joi.string().optional(),
  status: Joi.string().valid("draft", "published").default("published"),
});

export const createTestimonialSchema = Joi.object({
  name_ar: Joi.string().optional(),
  name_en: Joi.string().optional(),
  message_ar: Joi.string().optional(),
  message_en: Joi.string().optional(),
  image: Joi.string().uri().optional(),
});

export const createBranchSchema = Joi.object({
  name_ar: Joi.string().optional(),
  name_en: Joi.string().optional(),
  area_ar: Joi.string().optional(),
  area_en: Joi.string().optional(),
  address_ar: Joi.string().optional(),
  address_en: Joi.string().optional(),
  phone: Joi.string().optional(),
  google_map: Joi.string().optional().allow("", null),
  image: Joi.string().uri().optional().allow("", null),
  works_hours: Joi.string().optional().allow("", null),
});

// Address validation schemas
export const createAddressSchema = Joi.object({
  street: Joi.string().required().messages({
    "any.required": "Street is required",
    "string.empty": "Street cannot be empty",
  }),
  building: Joi.string().optional().allow("", null),
  floor: Joi.string().optional().allow("", null),
  apartment: Joi.string().optional().allow("", null),
  area: Joi.string().optional().allow("", null),
  city: Joi.string().required().messages({
    "any.required": "City is required",
    "string.empty": "City cannot be empty",
  }),
  notes: Joi.string().optional().allow("", null),
  is_default: Joi.boolean().optional().default(false),
});

export const updateAddressSchema = Joi.object({
  street: Joi.string().optional(),
  building: Joi.string().optional().allow("", null),
  floor: Joi.string().optional().allow("", null),
  apartment: Joi.string().optional().allow("", null),
  area: Joi.string().optional().allow("", null),
  city: Joi.string().optional(),
  notes: Joi.string().optional().allow("", null),
  is_default: Joi.boolean().optional(),
});

// Payment validation schemas
export const initiatePaymentSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    "number.positive": "Amount must be a positive number",
    "any.required": "Amount is required",
  }),
  currency: Joi.string()
    .valid("EGP", "USD", "SAR", "EUR")
    .optional()
    .default("EGP"),
  paymentOptions: Joi.array()
    .items(Joi.number().integer().min(2).max(6))
    .min(1)
    .optional()
    .default([2, 3, 4, 5, 6])
    .messages({
      "array.min": "At least one payment option is required",
    }),
  cashExpiry: Joi.number()
    .integer()
    .min(1)
    .max(24)
    .optional()
    .default(3)
    .messages({
      "number.min": "Cash expiry must be at least 1 hour",
      "number.max": "Cash expiry cannot exceed 24 hours",
    }),
  name: Joi.string().min(2).required().messages({
    "string.min": "Name must be at least 2 characters",
    "any.required": "Customer name is required",
  }),
  email: Joi.string().email().optional().allow("", null).messages({
    "string.email": "Please provide a valid email address",
  }),
  mobile: Joi.string()
    .pattern(/^(01[0125]\d{8}|(\+20|0020)01[0125]\d{8})$/)
    .required()
    .messages({
      "string.pattern.base": "Please provide a valid Egyptian phone number",
      "any.required": "Mobile number is required",
    }),
  redirectUrl: Joi.string().uri().optional().messages({
    "string.uri": "Redirect URL must be a valid URL",
  }),
  customerReference: Joi.alternatives()
    .try(Joi.string(), Joi.number())
    .optional(),
  // Keep order_id for backward compatibility and internal use
  order_id: Joi.string().uuid().optional().messages({
    "string.guid": "Order ID must be a valid UUID",
  }),
});

export const paymentCallbackSchema = Joi.object({
  ProductCode: Joi.string().optional().allow("", null),
  PaymentMethod: Joi.string().optional().allow("", null),
  ProductType: Joi.string().optional().allow("", null),
  Amount: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  BuyerEmail: Joi.string().email().optional().allow("", null),
  BuyerMobile: Joi.string().optional().allow("", null),
  BuyerName: Joi.string().optional().allow("", null),
  Timestamp: Joi.alternatives()
    .try(Joi.string(), Joi.number())
    .optional()
    .allow("", null),
  status: Joi.string()
    .valid(
      "PAID",
      "PENDING",
      "FAILED",
      "NEW",
      "CANCELED",
      "CANCELLED",
      "REFUNDED",
      "EXPIRED",
      "SUCCESS",
      "COMPLETED",
      "DELIVERED",
      "DECLINED"
    )
    .insensitive()
    .required(),
  voucher: Joi.string().optional().allow("", null),
  easykashRef: Joi.string().required(),
  VoucherData: Joi.string().optional().allow("", null),
  customerReference: Joi.string().optional().allow("", null),
  signatureHash: Joi.string().optional().allow("", null),
}).unknown(true); // Allow unknown fields from Easykash
