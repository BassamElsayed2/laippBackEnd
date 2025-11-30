import { z } from "zod";
import { uuidSchema } from "../utils/validation";

const productSizeSchema = z.object({
  id: uuidSchema.optional(),
  type_id: uuidSchema.optional(),
  size_ar: z.string().min(1),
  size_en: z.string().min(1),
  price: z.number().positive(),
  offer_price: z.number().positive().nullable().optional(),
  created_at: z.string().optional(),
});

const productTypeSchema = z.object({
  id: uuidSchema.optional(),
  product_id: uuidSchema.optional(),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  sizes: z.array(productSizeSchema).min(1),
  created_at: z.string().optional(),
});

export const createProductSchema = z.object({
  title_ar: z.string().min(2).max(255),
  title_en: z.string().min(2).max(255),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  category_id: uuidSchema,
  user_id: uuidSchema.optional(),
  image_url: z.string().url().optional(),
  types: z.array(productTypeSchema).min(1),
});

export const updateProductSchema = z.object({
  title_ar: z.string().min(2).max(255).optional(),
  title_en: z.string().min(2).max(255).optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  category_id: uuidSchema.optional(),
  user_id: uuidSchema.optional(),
  image_url: z.string().url().optional(),
  is_active: z.boolean().optional(),
  types: z.array(productTypeSchema).optional(),
});

export const getProductsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10"),
  category_id: uuidSchema.optional(),
  branch_id: uuidSchema.optional(),
  search: z.string().max(255).optional(),
  is_active: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});
