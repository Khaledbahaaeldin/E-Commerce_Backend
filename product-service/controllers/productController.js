// filepath: /home/khaled/Documents/GitHub/E-Commerce_Backend/product-service/controllers/productController.js
// filepath: /home/khaled/Documents/GitHub/E-Commerce_Backend/product-service/controllers/productController.js
const Product = require('../models/Product');
const axios = require('axios');
const redis = require('redis'); // Added

// --- Redis Client Setup ---
let redisClient;
(async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    // Application can continue without cache, but log the error
    redisClient = null; 
  }
})();
// --- End Redis Client Setup ---

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
      sellerId: req.user.id // Assuming protect middleware adds user info
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
  const productId = req.params.id;
  const cacheKey = `product:${productId}`;

  try {
    // --- Check Cache ---
    if (redisClient?.isOpen) { // Check if client connected successfully and is open
      const cachedProduct = await redisClient.get(cacheKey);
      if (cachedProduct) {
        console.log(`Cache hit for ${cacheKey}`);
        return res.json(JSON.parse(cachedProduct));
      }
      console.log(`Cache miss for ${cacheKey}`);
    }
    // --- End Check Cache ---

    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // --- Store in Cache ---
    if (redisClient?.isOpen) {
      try {
        // Cache for 5 minutes (300 seconds)
        await redisClient.set(cacheKey, JSON.stringify(product), { EX: 300 }); 
        console.log(`Cached data for ${cacheKey}`);
      } catch (cacheError) {
        console.error(`Failed to cache data for ${cacheKey}:`, cacheError);
      }
    }
    // --- End Store in Cache ---
    
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
  const productId = req.params.id;
  const cacheKey = `product:${productId}`;
  try {
    let product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is seller of the product or admin
    if (product.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }
    
    product = await Product.findByIdAndUpdate(
      productId,
      req.body,
      { new: true, runValidators: true }
    );

    // --- Invalidate Cache ---
    if (redisClient?.isOpen) {
      try {
        await redisClient.del(cacheKey);
        console.log(`Invalidated cache for ${cacheKey}`);
      } catch (cacheError) {
         console.error(`Failed to invalidate cache for ${cacheKey}:`, cacheError);
      }
    }
    // --- End Invalidate Cache ---
    
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
  const productId = req.params.id;
  const cacheKey = `product:${productId}`;
  try {
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is seller of the product or admin
    if (product.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }
    
    await product.deleteOne();

    // --- Invalidate Cache ---
     if (redisClient?.isOpen) {
      try {
        await redisClient.del(cacheKey);
        console.log(`Invalidated cache for ${cacheKey}`);
      } catch (cacheError) {
         console.error(`Failed to invalidate cache for ${cacheKey}:`, cacheError);
      }
    }
    // --- End Invalidate Cache ---
    
    res.json({ message: 'Product removed' });
  } catch (error) {
    console.error(error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update product stock (Manual Set)
// @route   PATCH /api/products/:id/stock
// @access  Private (Seller or Admin)
exports.updateStock = async (req, res) => {
  const productId = req.params.id;
  const cacheKey = `product:${productId}`;
  try {
    const { quantity } = req.body;
    
    if (quantity === undefined || Number(quantity) < 0) {
      return res.status(400).json({ message: 'Please provide a non-negative quantity' });
    }
    
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if user is seller/admin for manual updates
    if (req.user && product.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
       return res.status(403).json({ message: 'Not authorized to update this product stock' });
    }
    
    product.stockQuantity = Number(quantity);
    // isLowStock will be updated by the pre-save hook
    
    await product.save();

    // --- Invalidate Cache ---
     if (redisClient?.isOpen) {
      try {
        await redisClient.del(cacheKey);
        console.log(`Invalidated cache for ${cacheKey} after stock update`);
      } catch (cacheError) {
         console.error(`Failed to invalidate cache for ${cacheKey}:`, cacheError);
      }
    }
    // --- End Invalidate Cache ---

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Decrease product stock (Internal use, e.g., by Order Service)
// @route   PATCH /api/products/:id/stock/decrease
// @access  Internal / Private - Needs proper security
exports.decreaseStock = async (req, res) => {
    const productId = req.params.id;
    const cacheKey = `product:${productId}`;
    try {
        // TODO: Implement internal service authentication (e.g., shared secret header, internal JWT)
        // const internalAuthHeader = req.headers['x-internal-auth'];
        // if (!internalAuthHeader || internalAuthHeader !== process.env.INTERNAL_SERVICE_SECRET) {
        //     return res.status(403).json({ message: 'Forbidden: Invalid internal credentials' });
        // }

        const { quantity } = req.body;
        const decreaseAmount = Number(quantity);

        if (!decreaseAmount || decreaseAmount <= 0) {
            return res.status(400).json({ message: 'Please provide a positive quantity to decrease' });
        }

        // Use findOneAndUpdate for atomic operation to prevent race conditions
        const updatedProduct = await Product.findOneAndUpdate(
            { _id: productId, stockQuantity: { $gte: decreaseAmount } }, // Find product with enough stock
            { $inc: { stockQuantity: -decreaseAmount } }, // Atomically decrease stock
            { new: true } // Return the updated document
        );

        if (!updatedProduct) {
            // If product not found OR stock was insufficient (query condition failed)
            const productExists = await Product.findById(productId).select('stockQuantity name');
            if (!productExists) {
                return res.status(404).json({ message: 'Product not found' });
            } else {
                console.warn(`Insufficient stock for product ${productExists.name} (${productId}). Requested: ${decreaseAmount}, Available: ${productExists.stockQuantity}`);
                return res.status(400).json({ message: `Insufficient stock for product ${productExists.name}. Available: ${productExists.stockQuantity}` });
            }
        }

        // Manually trigger the pre-save hook logic for isLowStock after atomic update
        updatedProduct.isLowStock = updatedProduct.stockQuantity <= updatedProduct.lowStockThreshold;
        await updatedProduct.save(); // Save the isLowStock change

        // --- Invalidate Cache ---
        if (redisClient?.isOpen) {
            try {
                await redisClient.del(cacheKey);
                console.log(`Invalidated cache for ${cacheKey} after stock decrease`);
            } catch (cacheError) {
                console.error(`Failed to invalidate cache for ${cacheKey}:`, cacheError);
            }
        }
        // --- End Invalidate Cache ---

        res.json({
            _id: updatedProduct._id,
            stockQuantity: updatedProduct.stockQuantity,
            isLowStock: updatedProduct.isLowStock
        });

    } catch (error) {
        console.error(`Error decreasing stock for ${productId}:`, error);
        if (error.kind === 'ObjectId') {
          return res.status(404).json({ message: 'Product not found' });
        }
        res.status(500).json({ message: 'Server error decreasing stock', error: error.message });
    }
};

// @desc    Get products with low stock
// @route   GET /api/products/inventory/low-stock
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