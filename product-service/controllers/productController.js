const Product = require('../models/Product');
const axios = require('axios');

// @desc    Create a new product
// @route   POST /api/products
// @access  Private (Sellers only)
exports.createProduct = async (req, res) => {
  try {
    // Get user info from auth service to verify seller role
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    // Add seller ID from the authenticated user
    const product = await Product.create({
      ...req.body,
      sellerId: req.user.id
    });

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const { 
      category, 
      minPrice, 
      maxPrice, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      limit = 10,
      page = 1
    } = req.query;

    // Build query
    const query = {};
    
    // Filter by category if provided
    if (category) {
      query.category = category;
    }
    
    // Filter by price range if provided
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
    }

    // Count total documents for pagination
    const totalProducts = await Product.countDocuments(query);

    // Execute query with pagination and sorting
    const products = await Product.find(query)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    res.json({
      products,
      currentPage: Number(page),
      totalPages: Math.ceil(totalProducts / Number(limit)),
      totalProducts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get a single product
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private (Seller or Admin)
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is seller of the product or admin
    if (product.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }
    
    product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.json(product);
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private (Seller or Admin)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is seller of the product or admin
    if (product.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }
    
    await product.deleteOne();
    
    res.json({ message: 'Product removed' });
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update product stock
// @route   PATCH /api/products/:id/stock
// @access  Private (Seller or Admin)
exports.updateStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (quantity === undefined) {
      return res.status(400).json({ message: 'Please provide quantity' });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is seller of the product or admin
    if (product.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this product stock' });
    }
    
    product.stockQuantity = Number(quantity);
    product.isLowStock = Number(quantity) <= product.lowStockThreshold;
    
    await product.save();
    
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get products with low stock
// @route   GET /api/products/low-stock
// @access  Private (Seller or Admin)
exports.getLowStockProducts = async (req, res) => {
  try {
    // For admin, get all low stock products
    // For sellers, get only their low stock products
    const query = { 
      isLowStock: true 
    };
    
    // If not admin, filter by seller ID
    if (req.user.role !== 'admin') {
      query.sellerId = req.user.id;
    }
    
    const products = await Product.find(query);
    
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};