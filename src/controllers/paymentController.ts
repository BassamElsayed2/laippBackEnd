import { Response, NextFunction } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getPool, sql } from '../config/database';
import { AuthRequest, EasykashCallback } from '../types';
import { ApiError } from '../middleware/errorHandler';
import { verifyEasykashSignature } from '../utils/helpers';

const EASYKASH_API_URL = process.env.EASYKASH_API_URL || '';
const EASYKASH_SECRET_KEY = process.env.EASYKASH_SECRET_KEY || '';
const EASYKASH_REDIRECT_URL = process.env.EASYKASH_REDIRECT_URL || '';

/**
 * Initiate payment with Easykash
 */
export const initiatePayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      order_id,
      amount,
      name,
      email,
      mobile,
      paymentOptions, // Array of payment option IDs
    } = req.body;

    if (!order_id || !amount || !name || !mobile) {
      throw new ApiError(400, 'Missing required payment fields');
    }

    const pool = getPool();

    // Check if order exists
    const orderResult = await pool
      .request()
      .input('order_id', sql.UniqueIdentifier, order_id)
      .query(`
        SELECT id, total_price, status
        FROM orders
        WHERE id = @order_id
      `);

    if (orderResult.recordset.length === 0) {
      throw new ApiError(404, 'Order not found');
    }

    const order = orderResult.recordset[0];

    if (order.status !== 'pending') {
      throw new ApiError(400, 'Order is not in pending status');
    }

    // Prepare Easykash payment request
    const paymentRequest = {
      amount: parseFloat(amount.toString()),
      currency: 'EGP',
      paymentOptions: paymentOptions || [2, 3, 4, 5, 6], // Default: all options
      cashExpiry: 3, // 3 days
      name,
      email: email || '',
      mobile,
      redirectUrl: EASYKASH_REDIRECT_URL,
      customerReference: order_id,
    };

    try {
      // Call Easykash API
      const easykashResponse = await axios.post(
        EASYKASH_API_URL,
        paymentRequest,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Update payment record with Easykash details
      await pool
        .request()
        .input('order_id', sql.UniqueIdentifier, order_id)
        .input('payment_status', sql.NVarChar, 'pending')
        .query(`
          UPDATE payments
          SET payment_status = @payment_status,
              updated_at = GETDATE()
          WHERE order_id = @order_id
        `);

      // Return redirect URL
      res.json({
        success: true,
        data: {
          redirectUrl: easykashResponse.data.redirectUrl,
          order_id,
        },
        message: 'Payment initiated successfully',
      });
    } catch (easykashError: any) {
      console.error('Easykash API Error:', easykashError.response?.data || easykashError.message);
      throw new ApiError(500, 'Failed to initiate payment with Easykash');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Easykash payment callback
 */
export const handlePaymentCallback = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const callbackData: EasykashCallback = req.body;

    console.log('Easykash Callback Received:', callbackData);

    // Verify signature
    const isValid = verifyEasykashSignature(callbackData, EASYKASH_SECRET_KEY);

    if (!isValid) {
      console.error('Invalid Easykash signature');
      throw new ApiError(400, 'Invalid payment signature');
    }

    const {
      ProductCode,
      PaymentMethod,
      Amount,
      status,
      easykashRef,
      voucher,
      customerReference,
    } = callbackData;

    const pool = getPool();

    // Get order
    const orderResult = await pool
      .request()
      .input('order_id', sql.UniqueIdentifier, customerReference)
      .query(`
        SELECT id, status, total_price
        FROM orders
        WHERE id = @order_id
      `);

    if (orderResult.recordset.length === 0) {
      throw new ApiError(404, 'Order not found');
    }

    const order = orderResult.recordset[0];

    // Update payment record
    const paymentStatus = status === 'PAID' ? 'completed' : status === 'FAILED' ? 'failed' : 'pending';

    await pool
      .request()
      .input('order_id', sql.UniqueIdentifier, customerReference)
      .input('payment_status', sql.NVarChar, paymentStatus)
      .input('payment_provider', sql.NVarChar, PaymentMethod)
      .input('easykash_ref', sql.NVarChar, easykashRef)
      .input('easykash_product_code', sql.NVarChar, ProductCode)
      .input('voucher', sql.NVarChar, voucher || null)
      .query(`
        UPDATE payments
        SET payment_status = @payment_status,
            payment_provider = @payment_provider,
            easykash_ref = @easykash_ref,
            easykash_product_code = @easykash_product_code,
            voucher = @voucher,
            updated_at = GETDATE()
        WHERE order_id = @order_id
      `);

    // Update order status
    if (status === 'PAID') {
      await pool
        .request()
        .input('order_id', sql.UniqueIdentifier, customerReference)
        .input('status', sql.NVarChar, 'paid')
        .query(`
          UPDATE orders
          SET status = @status, updated_at = GETDATE()
          WHERE id = @order_id
        `);
    } else if (status === 'FAILED') {
      await pool
        .request()
        .input('order_id', sql.UniqueIdentifier, customerReference)
        .input('status', sql.NVarChar, 'cancelled')
        .query(`
          UPDATE orders
          SET status = @status, updated_at = GETDATE()
          WHERE id = @order_id
        `);
    }

    res.json({
      success: true,
      message: 'Payment callback processed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment status for an order
 */
export const getPaymentStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { order_id } = req.params;
    const pool = getPool();

    const paymentResult = await pool
      .request()
      .input('order_id', sql.UniqueIdentifier, order_id)
      .query(`
        SELECT *
        FROM payments
        WHERE order_id = @order_id
      `);

    if (paymentResult.recordset.length === 0) {
      throw new ApiError(404, 'Payment not found');
    }

    res.json({
      success: true,
      data: paymentResult.recordset[0],
    });
  } catch (error) {
    next(error);
  }
};


