// filepath: /home/khaled/Documents/GitHub/E-Commerce_Backend/payment-service/controllers/paymentController.js
// filepath: payment-service/controllers/paymentController.js
const axios = require('axios');
const Payment = require('../models/Payment'); // Corrected filename case

// Helper to notify Order Service about payment status
const notifyOrderService = async (orderId, status, transactionDetails, authToken) => {
  const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://order-service:3002';
  try {
    // TODO: Replace authToken with a secure internal service token/key
    const headers = {};
    // if (internalApiKey) { headers['X-Internal-API-Key'] = internalApiKey; }
    
    await axios.put(`${orderServiceUrl}/api/orders/${orderId}/payment-status`, 
    { 
      status: status, // 'successful' or 'failed'
      paymentResult: transactionDetails 
    }, 
    {
      // headers: headers // Pass internal auth header here
    });
    console.log(`Notified order service for order ${orderId}, status: ${status}`);
  } catch (error) {
    console.error(`Failed to notify order service for order ${orderId}:`, error.response?.data || error.message);
    // Implement retry logic or queuing if necessary for critical notifications
  }
};

// @desc    Initiate PayMob payment process
// @route   POST /api/payments/initiate/paymob
// @access  Private (called by Order Service)
exports.initiatePaymobPayment = async (req, res) => {
  const { orderId, amount, currency = 'EGP', billingData, userId } = req.body;
  // const authToken = req.headers.authorization; // Auth token from original user request (if needed, but usually not for internal calls)

  if (!orderId || !amount || !billingData || !userId) {
    return res.status(400).json({ message: 'Missing required payment details' });
  }

  try {
    // 1. Authentication Request
    const authResponse = await axios.post('https://accept.paymob.com/api/auth/tokens', {
      api_key: process.env.PAYMOB_API_KEY
    });
    const { token: paymobAuthToken } = authResponse.data;

    // 2. Order Registration
    const amountCents = Math.round(amount * 100);
    const orderResponse = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
      auth_token: paymobAuthToken,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: currency,
      merchant_order_id: orderId, // Use our order ID
      items: [] // PayMob requires items, but we can send an empty array if total amount is primary
    });
    const paymobOrderId = orderResponse.data.id;

    // 3. Payment Key Request
    const paymentKeyResponse = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
      auth_token: paymobAuthToken,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: { // Use billingData passed from order service
        ...billingData,
        apartment: billingData.apartment || 'NA',
        email: billingData.email,
        floor: billingData.floor || 'NA',
        first_name: billingData.firstName,
        street: billingData.street,
        building: billingData.building || 'NA',
        phone_number: billingData.phone,
        shipping_method: 'NA',
        postal_code: billingData.postalCode,
        city: billingData.city,
        country: billingData.country,
        last_name: billingData.lastName,
        state: billingData.state || 'NA'
      },
      currency: currency,
      integration_id: process.env.PAYMOB_INTEGRATION_ID,
      lock_order_when_paid: "true"
    });

    // Store initial payment record
    await Payment.create({
      orderId: orderId,
      userId: userId,
      paymobOrderId: paymobOrderId,
      amountCents: amountCents,
      currency: currency,
      status: 'pending',
      paymentGateway: 'paymob'
    });

    // Return payment token and iframe URL
    res.json({
      payment_token: paymentKeyResponse.data.token,
      iframe_url: `https://accept.paymobsolutions.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentKeyResponse.data.token}`
    });

  } catch (error) {
    console.error('PayMob initiation error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'Payment initiation failed',
      error: error.response?.data || error.message
    });
  }
};

// @desc    Handle PayMob callback (webhook)
// @route   POST /api/payments/callback/paymob
// @access  Public (Webhook from PayMob)
exports.paymobCallback = async (req, res) => {
  try {
    const callbackData = req.body.obj;
    const hmac = req.query.hmac; // Get HMAC from query params

    // TODO: Validate HMAC signature from PayMob to ensure request authenticity
    // const isValid = validatePaymobHmac(req.body, hmac, process.env.PAYMOB_HMAC_SECRET);
    // if (!isValid) {
    //   console.warn('Invalid PayMob HMAC received');
    //   return res.status(403).json({ message: 'Invalid signature' });
    // }

    const paymobOrderId = callbackData.order.id;
    const success = callbackData.success;
    const transactionId = callbackData.id;
    const isPending = callbackData.pending;

    console.log(`PayMob Callback received for Order ID: ${paymobOrderId}, Success: ${success}, Pending: ${isPending}, Txn ID: ${transactionId}`);

    if (isPending) {
      // Ignore pending callbacks, wait for final status
      return res.status(200).json({ message: 'Pending notification received' });
    }

    // Find the corresponding payment record
    const payment = await Payment.findOne({ paymobOrderId: paymobOrderId });

    if (!payment) {
      console.error(`Payment record not found for PayMob Order ID: ${paymobOrderId}`);
      // Acknowledge receipt but indicate an issue
      return res.status(404).json({ message: 'Payment record not found' }); 
    }

    // Avoid processing duplicate callbacks
    if (payment.status !== 'pending') {
        console.log(`Payment ${payment._id} already processed with status: ${payment.status}. Ignoring callback.`);
        return res.status(200).json({ message: 'Callback already processed' });
    }

    const paymentStatus = success ? 'successful' : 'failed';
    
    // Update payment record
    payment.status = paymentStatus;
    payment.paymobTransactionId = transactionId;
    await payment.save();

    console.log(`Payment ${payment._id} updated to ${paymentStatus}`);

    // Prepare details for order service notification
    const transactionDetails = {
      id: transactionId, // PayMob Transaction ID
      status: callbackData.data?.message || paymentStatus,
      update_time: callbackData.created_at,
      gatewayOrderId: paymobOrderId,
      amount: callbackData.amount_cents / 100,
      currency: callbackData.currency
    };

    // Notify Order Service - Pass null for authToken, assuming internal trust or future internal auth mechanism
    await notifyOrderService(payment.orderId, paymentStatus, transactionDetails, null); 

    // --- Serverless Trigger Point ---
    if (paymentStatus === 'successful') {
      console.log(`Placeholder: Trigger serverless function for successful payment email for order ${payment.orderId}`);
      // Example: triggerEmailNotification('payment_success', { userId: payment.userId, orderId: payment.orderId, amount: payment.amountCents / 100 });
    } else {
      console.log(`Placeholder: Trigger serverless function for failed payment email for order ${payment.orderId}`);
      // Example: triggerEmailNotification('payment_failure', { userId: payment.userId, orderId: payment.orderId });
    }
    // --- End Serverless Trigger Point ---

    // Acknowledge receipt to PayMob
    res.status(200).json({ message: 'Callback processed successfully' });

  } catch (error) {
    console.error('PayMob callback processing error:', error);
    // Don't send error details back to PayMob, just acknowledge receipt issue
    res.status(500).json({ message: 'Internal server error processing callback' });
  }
};