import { z } from "zod";
import { uuidSchema } from "../utils/validation";

const orderItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  offer_id: z.string().uuid().optional(),
  type: z.enum(["product", "offer"]),
  title_ar: z.string(),
  title_en: z.string(),
  quantity: z.number().int().positive(),
  price_per_unit: z.number().positive(),
  total_price: z.number().positive(),
  size: z.string().optional(),
  size_data: z.any().optional(),
  variants: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  address_id: uuidSchema.optional(),
  delivery_type: z.enum(["delivery", "pickup"]),
  branch_id: uuidSchema.optional(),
  items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
  subtotal: z.number().positive(),
  delivery_fee: z.number().min(0),
  total: z.number().positive(),
  notes: z.string().max(500).optional(),
  payment_method: z.enum(["cash", "card", "wallet", "easykash"]).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "pending_payment",
    "confirmed",
    "preparing",
    "ready",
    "delivering",
    "delivered",
    "cancelled",
  ]),
});

export const getOrdersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10"),
  status: z
    .enum([
      "pending",
      "pending_payment",
      "confirmed",
      "preparing",
      "ready",
      "delivering",
      "delivered",
      "cancelled",
    ])
    .optional(),
  order_id: z.string().optional(),
});

export const getOrderStatsQuerySchema = z
  .object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    branch_id: z.string().uuid().optional(),
  })
  .optional();
