const Order = require('../models/Order');
const axios = require('axios');

// Helper function to get product details from product service
const getProductDetails = async (productId) => {
  const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://product-service:4000';
  const response = await axios.get(`${productServiceUrl}/api/products/${productId}`);
  return response.data;
};

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const { 
      items, 
      shipping, 
      paymentMethod 
    } = req.body;

    // Validate required fields
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }
    if (!shipping) {
      return res.status(400).json({ message: 'Shipping info is required' });
    }

    // Fetch product details from product service and calculate prices
    let itemsPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await getProductDetails(item.productId);
      
      // Check if product exists and has enough stock
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }
      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${product.name}` });
      }
      
      // Calculate price and add to order items
      const itemPrice = product.price * item.quantity;
      itemsPrice += itemPrice;
      
      orderItems.push({
        productId: item.productId,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        image: product.images && product.images.length > 0 ? product.images[0] : ''
      });
    }

    // Calculate additional costs
    const shippingPrice = itemsPrice > 100 ? 0 : 10; // Free shipping over $100
    const taxPrice = Number((0.15 * itemsPrice).toFixed(2)); // 15% tax
    const totalPrice = itemsPrice + shippingPrice + taxPrice;

    // Create order
    const order = await Order.create({
      userId: req.user._id,
      items: orderItems,
      shipping,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      taxPrice,
      totalPrice
    });

    // Update product stock
    for (const item of items) {
      const product = await getProductDetails(item.productId);
      await axios.patch(`${process.env.PRODUCT_SERVICE_URL}/api/products/${item.productId}/stock`, {
        quantity: product.stockQuantity - item.quantity
      }, {
        headers: { Authorization: req.headers.authorization }
      });
    }

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get user orders
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user is order owner or admin
    if (order.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this order' });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update order status (admin only)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    
    // If status is delivered, update isDelivered and deliveredAt
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
    }

    await order.save();
    
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
exports.updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user is order owner
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    order.isPaid = true;
    order.paidAt = Date.now();
    order.status = 'processing';
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.email_address
    };

    const updatedOrder = await order.save();
    
    res.json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create PayMob payment
// @route   POST /api/orders/:id/pay/paymob
// @access  Private
exports.createPaymobPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user is order owner
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized for this order' });
    }

    if (order.isPaid) {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    // 1. Authentication Request to get auth token
    const authResponse = await axios.post('https://accept.paymob.com/api/auth/tokens', {
      api_key: process.env.PAYMOB_API_KEY
    });

    const { token } = authResponse.data;

    // 2. Order Registration
    const orderResponse = await axios.post('https://accept.paymob.com/api/ecommerce/orders', {
      auth_token: token,
      delivery_needed: false,
      amount_cents: order.totalPrice * 100, // Convert to cents
      items: order.items.map(item => ({
        name: item.name,
        amount_cents: item.price * 100 * item.quantity,
        description: `${item.name} x ${item.quantity}`,
        quantity: item.quantity
      }))
    });

    // 3. Payment Key Request
    const paymentKeyResponse = await axios.post('https://accept.paymob.com/api/acceptance/payment_keys', {
      auth_token: token,
      amount_cents: order.totalPrice * 100,
      expiration: 3600,
      order_id: orderResponse.data.id,
      billing_data: {
        apartment: 'NA',
        email: req.user.email,
        floor: 'NA',
        first_name: req.user.name.split(' ')[0],
        street: order.shipping.address,
        building: 'NA',
        phone_number: order.shipping.phone,
        shipping_method: 'NA',
        postal_code: order.shipping.postalCode,
        city: order.shipping.city,
        country: order.shipping.country,
        last_name: req.user.name.split(' ').length > 1 ? req.user.name.split(' ')[1] : 'NA',
        state: 'NA'
      },
      currency: 'EGP',
      integration_id: process.env.PAYMOB_INTEGRATION_ID
    });

    // Return payment token and iframe URL
    res.json({
      payment_token: paymentKeyResponse.data.token,
      iframe_url: `https://accept.paymobsolutions.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentKeyResponse.data.token}`
    });
  } catch (error) {
    console.error('PayMob payment error:', error.response?.data || error.message);
    res.status(500).json({ 
      message: 'Payment processing failed',
      error: error.response?.data || error.message
    });
  }
};

// @desc    Handle PayMob callback (webhook)
// @route   POST /api/orders/paymob-callback
// @access  Public
exports.paymobCallback = async (req, res) => {
  try {
    const { order_id, success, transaction_id } = req.body;
    
    // Validate the transaction with PayMob API if needed
    
    if (success) {
      // Find the order in our system
      // Note: You'll need to store PayMob order ID in your order or have a mapping
      const order = await Order.findOne({ 'paymentResult.id': order_id });
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
      // Update order status
      order.isPaid = true;
      order.paidAt = Date.now();
      order.status = 'processing';
      order.paymentResult = {
        id: order_id,
        status: 'completed',
        update_time: new Date().toISOString(),
        transaction_id
      };
      
      await order.save();
    }
    
    // Return success to PayMob
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('PayMob callback error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};