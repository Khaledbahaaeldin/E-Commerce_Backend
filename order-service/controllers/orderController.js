// filepath: /home/khaled/Documents/GitHub/E-Commerce_Backend/order-service/controllers/orderController.js
// filepath: order-service/controllers/orderController.js
const Order = require('../models/Order');
const axios = require('axios');

// Helper function (assuming it exists or is defined)
const getProductDetails = async (items) => {
    const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://product-service:4000';
    const productIds = items.map(item => item.productId);
    // In a real scenario, you might want a batch endpoint in product service
    const productDetails = {};
    for (const id of productIds) {
        try {
            // TODO: Add timeout and retry logic for this internal call
            const { data } = await axios.get(`${productServiceUrl}/api/products/${id}`);
            productDetails[id] = data;
        } catch (error) {
            console.error(`Failed to fetch product ${id}:`, error.response?.data || error.message);
            // If a product is essential and cannot be fetched, fail the order creation early
            throw new Error(`Product with ID ${id} not found or product service unavailable.`);
        }
    }
    return productDetails;
};


// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { 
      items, 
      shipping, 
      paymentMethod // e.g., 'credit_card', 'cod'
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }
    if (!shipping) {
        return res.status(400).json({ message: 'Shipping address is required' });
    }
    if (!paymentMethod) {
        return res.status(400).json({ message: 'Payment method is required' });
    }

    // Fetch product details and check stock (optional here, better check before payment)
    const productDetailsMap = await getProductDetails(items);

    let itemsPrice = 0;
    const orderItems = items.map(item => {
        const productDetails = productDetailsMap[item.productId];
        if (!productDetails) {
            // This case should be handled by getProductDetails throwing an error
            throw new Error(`Product details could not be retrieved for ID ${item.productId}`); 
        }
        // Optional: Check stock here if needed, though better done before payment confirmation
        // if (productDetails.stockQuantity < item.quantity) {
        //     throw new Error(`Not enough stock for product ${productDetails.name}`);
        // }
        const itemTotalPrice = productDetails.price * item.quantity;
        itemsPrice += itemTotalPrice;
        return {
            productId: item.productId,
            name: productDetails.name,
            quantity: item.quantity,
            price: productDetails.price,
            image: productDetails.images?.[0] || '/uploads/sample.jpg' // Use first image or default
        };
    });

    // Calculate prices (simple example)
    const shippingPrice = itemsPrice > 100 ? 0 : 10; // Example logic
    const taxPrice = Number((0.15 * itemsPrice).toFixed(2)); // Example 15% tax
    const totalPrice = itemsPrice + shippingPrice + taxPrice;

    // Create order with 'pending' status initially
    const order = await Order.create({
      userId: req.user._id, // Assuming protect middleware adds user info
      items: orderItems,
      shipping,
      paymentMethod,
      itemsPrice: Number(itemsPrice.toFixed(2)),
      shippingPrice: Number(shippingPrice.toFixed(2)),
      taxPrice: Number(taxPrice.toFixed(2)),
      totalPrice: Number(totalPrice.toFixed(2)),
      status: 'pending' // Initial status
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Create Order Error:', error);
    // Provide more specific error messages if possible
    if (error.message.includes('Product with ID')) {
         res.status(400).json({ message: error.message }); // Bad request if product invalid
    } else {
         res.status(500).json({ message: 'Server Error creating order', error: error.message });
    }
  }
};

// @desc    Initiate payment for an existing order
// @route   POST /api/orders/:id/initiate-payment
// @access  Private
const initiatePayment = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('userId', 'name email'); // Populate user for billing data

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check ownership
        if (order.userId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized for this order' });
        }

        if (order.isPaid) {
            return res.status(400).json({ message: 'Order is already paid' });
        }
         if (order.status === 'cancelled' || order.status === 'payment_failed' || order.status === 'payment_received_stock_error') {
            return res.status(400).json({ message: `Cannot initiate payment for order with status: ${order.status}` });
        }


        // Prepare data for payment service
        const paymentData = {
            orderId: order._id,
            amount: order.totalPrice,
            currency: 'EGP', // Or get from order/config
            userId: req.user._id,
            billingData: {
                email: order.userId.email || 'notprovided@example.com', // Use populated email
                firstName: order.userId.name?.split(' ')[0] || 'N/A', // Use populated name
                lastName: order.userId.name?.split(' ').slice(1).join(' ') || 'N/A',
                phone: order.shipping.phone,
                street: order.shipping.address,
                city: order.shipping.city,
                country: order.shipping.country,
                postalCode: order.shipping.postalCode || 'NA'
                // Add other fields if available/needed: apartment, floor, building, state
            }
        };

        const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003';
        
        console.log(`Initiating payment for order ${order._id} via ${paymentServiceUrl}`);
        // Call Payment Service to initiate
        // TODO: Add timeout and potentially retry logic for this internal call
        const response = await axios.post(`${paymentServiceUrl}/api/payments/initiate/paymob`, paymentData, {
            headers: {
                // Pass necessary headers if payment service requires auth (e.g., internal API key)
                // 'X-Internal-API-Key': process.env.INTERNAL_API_KEY 
            }
        });

        // Return the payment initiation details (e.g., iframe URL) to the client
        res.json(response.data);

    } catch (error) {
        console.error('Payment initiation failed in order service:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            message: 'Failed to initiate payment', 
            error: error.response?.data || 'Internal server error or payment service unavailable' 
        });
    }
};


// @desc    Update order payment status (called by Payment Service)
// @route   PUT /api/orders/:id/payment-status
// @access  Internal (Payment Service) - Secure this endpoint appropriately
const updateOrderPaymentStatus = async (req, res) => {
    try {
        // TODO: Add security check: Ensure this request comes from a trusted source (Payment Service)
        // e.g., check an internal API key passed in headers, check source IP, or use internal JWT
        // const internalApiKey = req.headers['x-internal-api-key'];
        // if (internalApiKey !== process.env.INTERNAL_API_KEY) {
        //     return res.status(403).json({ message: 'Forbidden: Invalid internal key' });
        // }

        const { status, paymentResult } = req.body; // status: 'successful' or 'failed'
        const orderId = req.params.id;

        console.log(`Received payment status update for order ${orderId}: Status=${status}`);

        const order = await Order.findById(orderId);

        if (!order) {
            console.error(`Order not found during payment status update: ${orderId}`);
            return res.status(404).json({ message: 'Order not found' });
        }

        // Avoid processing if order is already paid or in a final state
         if (order.isPaid && status === 'successful') {
            console.log(`Order ${orderId} is already marked as paid. Ignoring duplicate success update.`);
            return res.status(200).json(order); // Acknowledge but don't re-process
        }
        if (order.status === 'delivered' || order.status === 'cancelled') {
             console.log(`Order ${orderId} is already in final state ${order.status}. Ignoring payment update.`);
             return res.status(200).json(order);
        }


        if (status === 'successful') {
            order.isPaid = true;
            order.paidAt = new Date();
            order.status = 'processing'; // Update status after payment
            order.paymentResult = { // Store relevant details from payment service
                id: paymentResult?.id, // Transaction ID
                status: paymentResult?.status || 'successful',
                update_time: paymentResult?.update_time || new Date().toISOString(),
                gatewayOrderId: paymentResult?.gatewayOrderId // PayMob Order ID
            };

            console.log(`Order ${orderId} marked as paid. Attempting stock update...`);

            // --- Update product stock now that payment is confirmed ---
            try {
                const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://product-service:4000';
                for (const item of order.items) {
                    // Call product service to decrease stock using the correct endpoint
                     await axios.patch(`${productServiceUrl}/api/products/${item.productId}/stock/decrease`, {
                        quantity: item.quantity 
                    }, {
                        // Pass internal auth header if product service requires it
                        // headers: { 'X-Internal-API-Key': process.env.INTERNAL_API_KEY } 
                    });
                     console.log(`Stock decreased for product ${item.productId} by ${item.quantity}`);
                }
                console.log(`Stock update successful for order ${order._id}`);
            } catch (stockError) {
                console.error(`CRITICAL: Failed to update stock for order ${order._id}:`, stockError.response?.data || stockError.message);
                
                // --- Compensation / Recovery Strategy ---
                // Option 1: Mark order for manual review
                order.status = 'payment_received_stock_error'; 
                
                // Option 2: Enqueue a background job to retry stock update
                // await enqueueStockUpdateJob(order._id, order.items);
                
                // Option 3: Attempt immediate retry (use with caution, might block response)
                // let retries = 3;
                // while(retries > 0) { /* ... retry logic ... */ retries--; }
                
                // Log this critical error - requires monitoring and potentially manual intervention
                // Consider sending an alert to an admin/monitoring system
                // alertAdmin(`Stock update failed for paid order ${order._id}`);
                
                // Save the order with the error status
                await order.save(); 
                
                // Decide whether to return error or success to payment service callback
                // Returning success might be better if payment is confirmed, but log the internal issue.
                // Returning error might cause payment service to retry notification? (Check PayMob docs)
                // For now, let the order save and return the updated order with error status.
                return res.status(200).json(order); // Acknowledge payment, but order status reflects the issue
            }
            // --- End stock update ---

        } else { // Payment failed
            console.log(`Payment failed for order ${orderId}.`);
            order.isPaid = false;
            order.status = 'payment_failed'; // Update status
            // Optionally clear paymentResult or store failure reason
            order.paymentResult = {
                id: paymentResult?.id,
                status: 'failed',
                update_time: paymentResult?.update_time || new Date().toISOString(),
                message: paymentResult?.status || 'Payment failed or was cancelled'
            };
        }

        const updatedOrder = await order.save();
        console.log(`Order ${orderId} status updated to ${updatedOrder.status}`);
        res.json(updatedOrder);

    } catch (error) {
        console.error(`Error updating payment status for order ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server Error updating order payment status' });
    }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).populate('userId', 'id name email'); // Populate user details
        res.json(orders);
    } catch (error) {
        console.error('Get Orders Error:', error);
        res.status(500).json({ message: 'Server Error fetching orders' });
    }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.user._id });
        res.json(orders);
    } catch (error) {
        console.error('Get My Orders Error:', error);
        res.status(500).json({ message: 'Server Error fetching user orders' });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('userId', 'name email');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check ownership or admin role
        if (order.userId._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
             return res.status(403).json({ message: 'Not authorized to view this order' });
        }

        res.json(order);
    } catch (error) {
        console.error('Get Order By ID Error:', error);
         if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(500).json({ message: 'Server Error fetching order' });
    }
};

// @desc    Update order status (e.g., to shipped, delivered) (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        // Added error status to valid list
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'payment_failed', 'payment_received_stock_error']; 

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Add logic based on status transitions if needed
        // e.g., cannot move from delivered back to processing unless admin override
        // e.g., cannot move from cancelled to processing

        order.status = status;

        if (status === 'delivered' && !order.isDelivered) {
            order.isDelivered = true;
            order.deliveredAt = new Date();
        } else if (status !== 'delivered') {
             // If status changes away from delivered, reset delivery status? (depends on business logic)
             // order.isDelivered = false;
             // order.deliveredAt = null;
        }

        // Handle cancellation - should potentially refund and restock
        if (status === 'cancelled' && order.isPaid) {
            // TODO: Implement refund logic via payment service if order was paid
            console.warn(`Order ${order._id} cancelled but was paid. Implement refund logic.`);
            // TODO: Implement restocking logic via product service if needed
            // await restockItems(order.items); 
        } else if (status === 'cancelled' && !order.isPaid) {
             console.log(`Order ${order._id} cancelled (was not paid).`);
        }


        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (error) {
        console.error('Update Order Status Error:', error);
         if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(500).json({ message: 'Server Error updating order status' });
    }
};

// Export all controller functions used by routes
module.exports = {
    createOrder,
    initiatePayment,
    updateOrderPaymentStatus,
    getOrders,
    getMyOrders,
    getOrderById,
    updateOrderStatus
};