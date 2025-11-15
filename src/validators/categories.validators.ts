import { z } from "zod";

export const createCategorySchema = z.object({
  name_ar: z.string().min(1, "Arabic name is required"),
  name_en: z.string().min(1, "English name is required"),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const getCategoriesQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.enum(["true", "false"]).optional(),
});
