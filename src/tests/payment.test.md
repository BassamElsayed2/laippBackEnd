# Payment Integration Test Cases

## Test Scenarios

### 1. Payment Initiation Tests

#### Test 1.1: Successful Payment Initiation
**Given:**
- Valid order ID exists
- Order status is "pending"
- Order amount matches payment amount
- Valid customer details provided

**When:**
- POST `/api/payment/initiate` with valid data

**Expected Result:**
- Status: 200
- Response includes `redirectUrl`, `order_id`, `paymentId`
- Payment record created in database with `pending` status
- Customer can be redirected to EasyKash payment page

#### Test 1.2: Missing Required Fields
**Given:**
- Order ID or amount or name or mobile is missing

**When:**
- POST `/api/payment/initiate` with incomplete data

**Expected Result:**
- Status: 400
- Error message: "Missing required payment fields"

#### Test 1.3: Order Not Found
**Given:**
- Order ID doesn't exist in database

**When:**
- POST `/api/payment/initiate`

**Expected Result:**
- Status: 404
- Error message: "Order not found"

#### Test 1.4: Order Already Paid
**Given:**
- Order status is "paid" or payment status is "completed"

**When:**
- POST `/api/payment/initiate`

**Expected Result:**
- Status: 400
- Error message: "Order is already paid"

#### Test 1.5: Amount Mismatch
**Given:**
- Payment amount doesn't match order total

**When:**
- POST `/api/payment/initiate`

**Expected Result:**
- Status: 400
- Error message: "Payment amount does not match order total"

### 2. Payment Callback Tests

#### Test 2.1: Successful Payment (PAID Status)
**Given:**
- Valid callback data with status "PAID"
- Valid HMAC signature
- Payment exists in database

**When:**
- POST `/api/payment/easykash/callback`

**Request Body:**
```json
{
  "ProductCode": "CHQ4668",
  "PaymentMethod": "Credit & Debit Card",
  "ProductType": "Physical Product",
  "Amount": "50.5",
  "BuyerEmail": "test@example.com",
  "BuyerMobile": "01012345678",
  "BuyerName": "Test User",
  "Timestamp": "1626166791",
  "status": "PAID",
  "voucher": "",
  "easykashRef": "3242143421",
  "VoucherData": "Order Payment",
  "customerReference": "{\"orderId\":\"uuid\",\"paymentId\":\"uuid\",\"userId\":\"uuid\"}",
  "signatureHash": "valid-hash"
}
```

**Expected Result:**
- Status: 200
- Payment status updated to "completed"
- Order status updated to "confirmed"
- Payment record updated with:
  - `easykash_ref`
  - `payment_provider` (payment method)
  - `voucher` (if provided)

#### Test 2.2: Failed Payment
**Given:**
- Callback data with status "FAILED"

**When:**
- POST `/api/payment/easykash/callback`

**Expected Result:**
- Payment status updated to "failed"
- Order status updated to "cancelled" (if was pending)

#### Test 2.3: Invalid Signature
**Given:**
- Callback data with invalid HMAC signature
- HMAC secret is configured

**When:**
- POST `/api/payment/easykash/callback`

**Expected Result:**
- Status: 401
- Error message: "Invalid signature"
- Payment NOT updated

#### Test 2.4: Payment Not Found by customerReference
**Given:**
- customerReference doesn't contain valid order/payment IDs
- No payment found by easykashRef

**When:**
- POST `/api/payment/easykash/callback`

**Expected Result:**
- Status: 404
- Error message: "Payment not found"

#### Test 2.5: Payment Found by easykashRef
**Given:**
- customerReference is missing or invalid
- Payment exists with matching easykashRef

**When:**
- POST `/api/payment/easykash/callback`

**Expected Result:**
- Payment is found and updated successfully

#### Test 2.6: Cash Payment with Voucher
**Given:**
- Callback with PaymentMethod "Cash Through Fawry"
- Voucher number provided

**When:**
- POST `/api/payment/easykash/callback`

**Expected Result:**
- Payment status updated
- Voucher number saved in payment record

#### Test 2.7: Multiple Status Values
Test with each possible status:
- PAID → completed
- SUCCESS → completed
- COMPLETED → completed
- DELIVERED → completed
- FAILED → failed
- DECLINED → failed
- PENDING → pending
- NEW → pending
- CANCELED → cancelled
- CANCELLED → cancelled
- EXPIRED → cancelled
- REFUNDED → refunded

### 3. Payment Status Tests

#### Test 3.1: Get Payment Status (Authenticated)
**Given:**
- User is authenticated
- Payment exists for user's order

**When:**
- GET `/api/payment/{order_id}/status`

**Expected Result:**
- Status: 200
- Returns payment details including status

#### Test 3.2: Get Payment Status (Unauthorized)
**Given:**
- User is authenticated
- Payment exists but belongs to another user

**When:**
- GET `/api/payment/{order_id}/status`

**Expected Result:**
- Status: 404
- Error message: "Payment not found"

#### Test 3.3: Payment Not Found
**Given:**
- Order ID doesn't have associated payment

**When:**
- GET `/api/payment/{order_id}/status`

**Expected Result:**
- Status: 404
- Error message: "Payment not found"

### 4. Redirect Handler Tests

#### Test 4.1: Successful Redirect
**Given:**
- Valid customerReference in query params
- Payment exists

**When:**
- GET `/api/payment/redirect?status=success&providerRefNum=123&customerReference={"orderId":"uuid"}&voucher=456`

**Expected Result:**
- Status: 200
- Returns payment status information

#### Test 4.2: Failed Redirect
**Given:**
- status=failed in query params

**When:**
- GET `/api/payment/redirect`

**Expected Result:**
- Status: 200
- Returns failure status

#### Test 4.3: Missing customerReference
**Given:**
- customerReference is missing

**When:**
- GET `/api/payment/redirect`

**Expected Result:**
- Status: 400
- Error message: "Missing customerReference in redirect"

### 5. Validation Tests

#### Test 5.1: Phone Number Validation
Test with various phone formats:
- ✅ "01012345678" (valid)
- ✅ "+201012345678" (valid)
- ✅ "002001012345678" (valid)
- ❌ "1234567890" (invalid - wrong format)
- ❌ "01612345678" (invalid - wrong prefix)

#### Test 5.2: Email Validation
- ✅ "test@example.com" (valid)
- ✅ "" (valid - optional)
- ✅ null (valid - optional)
- ❌ "invalid-email" (invalid format)

#### Test 5.3: Currency Validation
- ✅ "EGP" (valid)
- ✅ "USD" (valid)
- ✅ "SAR" (valid)
- ✅ "EUR" (valid)
- ❌ "GBP" (invalid - not supported)

### 6. HMAC Signature Tests

#### Test 6.1: Verify Known Good Signature
**Test Data from EasyKash Docs:**
```
ProductCode: EDV4471
Amount: 11.00
ProductType: Direct Pay
PaymentMethod: Cash Through Fawry
status: PAID
easykashRef: 2911105009
customerReference: TEST11111
Secret: da9fe30575517d987762a859842b5631
Expected Signature: 0bd9ce502950ffa358314c170dace42e7ba3e0c776f5a32eb15c3d496bc9c294835036dd90d4f287233b800c9bde2f6591b6b8a1f675b6bfe64fd799da29d1d0
```

**Run Test:**
```typescript
PaymentService.testEasyKashSignature(); // Should return true
```

#### Test 6.2: No Signature Provided
**Given:**
- Callback data without signatureHash

**Expected:**
- Verification passes (allows callback to proceed)
- Warning logged

#### Test 6.3: No HMAC Secret Configured
**Given:**
- EASYKASH_HMAC_SECRET not set in environment

**Expected:**
- Verification passes (allows callback to proceed)
- Warning logged

### 7. Integration Tests

#### Test 7.1: Full Payment Flow
1. Create order → Order created with "pending" status
2. Initiate payment → Payment record created, redirectUrl received
3. Simulate EasyKash callback → Payment and order status updated
4. Check order status → Order is "confirmed"

#### Test 7.2: Payment Timeout/Expiry
1. Create order → Order created
2. Initiate payment → Payment created
3. Wait 30+ minutes → Check payment status
4. Expected: Payment marked as expired/cancelled

#### Test 7.3: Concurrent Payments
1. Create order
2. Initiate payment twice concurrently
3. Expected: Only one payment succeeds, other fails

### 8. Error Handling Tests

#### Test 8.1: EasyKash API Down
**Given:**
- EasyKash API is unreachable

**When:**
- POST `/api/payment/initiate`

**Expected Result:**
- Status: 500
- Error message: "EasyKash API error: ..."
- Payment record still created in database

#### Test 8.2: Database Connection Lost
**Given:**
- Database connection fails during callback

**When:**
- POST `/api/payment/easykash/callback`

**Expected Result:**
- Status: 500
- Error message returned
- EasyKash will retry callback

#### Test 8.3: Invalid JSON in customerReference
**Given:**
- customerReference contains invalid JSON

**When:**
- POST `/api/payment/easykash/callback`

**Expected Result:**
- Fallback to searching by easykashRef
- Payment still processed if found

## Manual Testing Checklist

### Setup
- [ ] Configure environment variables
- [ ] Set up EasyKash test account
- [ ] Configure callback URL in EasyKash dashboard
- [ ] Set up test database

### Frontend Tests
- [ ] Can add items to cart
- [ ] Can proceed to checkout
- [ ] Can select address
- [ ] Shipping fee calculated correctly
- [ ] Can click "Pay with EasyKash"
- [ ] Redirected to EasyKash page
- [ ] Can complete payment
- [ ] Redirected back to site
- [ ] Order confirmation shown

### Backend Tests
- [ ] Payment initiation creates record
- [ ] Callback is received and logged
- [ ] Signature verification works
- [ ] Payment status updated
- [ ] Order status updated
- [ ] Can query payment status
- [ ] Admin can view payments in dashboard

### Edge Cases
- [ ] Multiple simultaneous payments
- [ ] Payment after order cancelled
- [ ] Duplicate callbacks from EasyKash
- [ ] Very old callbacks (hours/days later)
- [ ] Callbacks in wrong order
- [ ] Missing/malformed callback data

## Test Tools

### cURL Commands

**Initiate Payment:**
```bash
curl -X POST http://localhost:5000/api/payment/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "order_id": "uuid",
    "amount": 100.50,
    "name": "Test User",
    "email": "test@example.com",
    "mobile": "01012345678",
    "currency": "EGP"
  }'
```

**Simulate Callback:**
```bash
curl -X POST http://localhost:5000/api/payment/easykash/callback \
  -H "Content-Type: application/json" \
  -d '{
    "ProductCode": "TEST123",
    "PaymentMethod": "Credit & Debit Card",
    "ProductType": "Physical Product",
    "Amount": "100.50",
    "status": "PAID",
    "easykashRef": "12345678",
    "customerReference": "{\"orderId\":\"uuid\",\"paymentId\":\"uuid\"}"
  }'
```

**Check Payment Status:**
```bash
curl http://localhost:5000/api/payment/{order_id}/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Performance Tests

### Load Tests
- [ ] 10 concurrent payment initiations
- [ ] 50 concurrent callbacks
- [ ] 100 status checks per second

### Database Performance
- [ ] Index on `easykash_ref` column
- [ ] Index on `customer_reference` column
- [ ] Query performance with 10k+ payments

### Response Times
- [ ] Payment initiation: < 2 seconds
- [ ] Callback processing: < 500ms
- [ ] Status check: < 100ms

