import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import {
  PaymentService,
  InitiatePaymentData,
} from "../services/payment.service";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../middleware/errorHandler";

/**
 * Initiate payment with EasyKash
 */
export const initiatePayment = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { order_id, amount, name, email, mobile, currency } = req.body;

    if (!order_id || !amount || !name || !mobile) {
      throw new ApiError(400, "Missing required payment fields");
    }

    // Get user ID if authenticated (optional for guest checkout)
    const userId = req.user?.id;

    const paymentData: InitiatePaymentData = {
      order_id,
      amount: parseFloat(amount.toString()),
      currency: currency,
      customer_name: name,
      customer_email: email,
      customer_phone: mobile,
    };

    const result = await PaymentService.initiatePayment(
      userId || "",
      paymentData
    );

    res.json({
      success: true,
      data: {
        redirectUrl: result.paymentUrl,
        order_id,
        paymentId: result.paymentId,
      },
      message: "Payment initiated successfully",
    });
  }
);

/**
 * Handle EasyKash payment callback
 */
export const handlePaymentCallback = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const callbackData = req.body;

    console.log("═══════════════════════════════════════");
    console.log("📞 EasyKash Callback Received");
    console.log("═══════════════════════════════════════");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(callbackData, null, 2));
    console.log("═══════════════════════════════════════");

    try {
      const result = await PaymentService.handleCallback(callbackData);

      console.log("✅ Callback processed successfully:", result);

      res.json({
        success: true,
        message: "Payment callback processed successfully",
        data: result,
      });
    } catch (error: any) {
      console.error("❌ Callback processing failed:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });

      // Still return 200 to Easykash to prevent retries
      // Log the error for investigation
      res.status(200).json({
        success: false,
        message: error.message || "Failed to process callback",
        error: error.message,
      });
    }
  }
);

/**
 * Handle EasyKash redirect callback (when user returns from payment page)
 * This handles the redirect URL parameters: status, providerRefNum, customerReference, voucher
 * NOTE: This is just the redirect - the actual payment status comes from the webhook/callback
 */
export const handlePaymentRedirect = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { status, providerRefNum, customerReference, voucher } = req.query;

    console.log("═══════════════════════════════════════");
    console.log("🔄 EasyKash Redirect Received");
    console.log("═══════════════════════════════════════");
    console.log("Status from redirect:", status);
    console.log("ProviderRefNum:", providerRefNum);
    console.log("CustomerReference:", customerReference);
    console.log("Voucher:", voucher);
    console.log("═══════════════════════════════════════");

    if (!customerReference) {
      throw new ApiError(400, "Missing customerReference in redirect");
    }

    // Parse customerReference to get order and payment info
    let customData: any = {};
    try {
      customData = JSON.parse(customerReference as string);
      console.log("✅ Parsed customerReference:", customData);
    } catch (e) {
      console.log("⚠️ customerReference is not JSON, using as orderId");
      customData = { orderId: customerReference };
    }

    // Get payment by order ID to find payment record
    const payment = await PaymentService.getPaymentByOrderId(
      customData.orderId || customerReference
    );

    if (!payment) {
      console.error(
        "❌ Payment not found for orderId:",
        customData.orderId || customerReference
      );
      throw new ApiError(404, "Payment not found");
    }

    console.log("📊 Current payment status in DB:", payment.payment_status);
    console.log("📊 Redirect status:", status);

    // IMPORTANT: The redirect status is NOT the final payment status
    // The real status comes from the webhook/callback
    // But we can return the current DB status for the frontend to poll

    res.json({
      success: true,
      data: {
        order_id: payment.order_id,
        payment_status: payment.payment_status, // Return current DB status
        redirect_status: status, // The status from redirect (may not be accurate)
        providerRefNum: providerRefNum || null,
        voucher: voucher || null,
      },
      message:
        "Payment redirect received. Please wait for final confirmation from payment gateway.",
    });
  }
);

/**
 * Get payment status for an order
 */
export const getPaymentStatus = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { order_id } = req.params;
    const userId = req.user?.id;

    const payment = await PaymentService.getPaymentByOrderId(order_id, userId);

    if (!payment) {
      throw new ApiError(404, "Payment not found");
    }

    res.json({
      success: true,
      data: payment,
    });
  }
);
