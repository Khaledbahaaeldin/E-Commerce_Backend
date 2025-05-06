// filepath: payment-service/routes/paymentRoutes.js
const express = require('express');
const { 
    initiatePaymobPayment, 
    paymobCallback 
} = require('../controllers/paymentController'); // Corrected path
// Add middleware for internal service authentication if needed later

const router = express.Router();

// Route called by Order Service to start payment
// Ensure protect middleware is added if this needs user authentication directly
router.post('/initiate/paymob', initiatePaymobPayment); 

// Public webhook route for PayMob callback
router.post('/callback/paymob', paymobCallback); 
// Paymob also uses GET for redirection after payment sometimes
router.get('/callback/paymob', (req, res) => { 
    // Handle redirection logic if needed, maybe redirect to frontend status page
    console.log("Received GET callback from PayMob:", req.query);
    // You might redirect to frontend: res.redirect(`${process.env.FRONTEND_URL}/order-status?order_id=${req.query.merchant_order_id}`);
    res.status(200).send("Callback received. Please check your order status.");
});

module.exports = router;