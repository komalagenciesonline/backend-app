const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Brand = require('../models/Brand');

// GET /api/products - Get all products with optional filtering
router.get('/', async (req, res) => {
  try {
    const { brand, search } = req.query;
    let query = {};

    // Filter by brand if specified
    if (brand && brand !== 'all') {
      query.brandName = brand;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brandName: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query).sort({ order: 1, createdAt: 1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products - Create new product
router.post('/', async (req, res) => {
  try {
    const { name, brandId, brandName } = req.body;

    // Validation
    if (!name || !brandId || !brandName) {
      return res.status(400).json({ error: 'Name, brandId, and brandName are required' });
    }

    // Check if brand exists
    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(400).json({ error: 'Brand not found' });
    }

    const product = new Product({
      name: name.trim(),
      brandId,
      brandName: brandName.trim()
    });

    const savedProduct = await product.save();
    
    // Update brand's product count
    await Brand.findByIdAndUpdate(brandId, { $inc: { productCount: 1 } });
    
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/order - Update product order (MUST be before /:id route)
router.put('/order', async (req, res) => {
  try {
    const { productOrders } = req.body;

    // Validation
    if (!productOrders || !Array.isArray(productOrders)) {
      return res.status(400).json({ error: 'productOrders array is required' });
    }

    // Update each product's order
    const updatePromises = productOrders.map(({ productId, order }) => {
      return Product.findByIdAndUpdate(
        productId,
        { order },
        { new: true }
      );
    });

    await Promise.all(updatePromises);
    
    res.json({ message: 'Product order updated successfully' });
  } catch (error) {
    console.error('Error updating product order:', error);
    res.status(500).json({ error: 'Failed to update product order' });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', async (req, res) => {
  try {
    const { name, brandId, brandName } = req.body;

    // Validation
    if (!name || !brandId || !brandName) {
      return res.status(400).json({ error: 'Name, brandId, and brandName are required' });
    }

    // Check if brand exists
    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(400).json({ error: 'Brand not found' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update product
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        brandId,
        brandName: brandName.trim()
      },
      { new: true }
    );

    // Update brand product counts if brand changed
    if (product.brandId.toString() !== brandId) {
      const oldBrand = await Brand.findByIdAndUpdate(
        product.brandId, 
        { $inc: { productCount: -1 } },
        { new: true }
      );
      
      // Automatically delete old brand if it has no products left
      if (oldBrand && oldBrand.productCount <= 0) {
        await Brand.findByIdAndDelete(product.brandId);
        console.log(`Brand "${oldBrand.name}" automatically deleted as it has no products`);
      }
      
      await Brand.findByIdAndUpdate(brandId, { $inc: { productCount: 1 } });
    }

    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);
    
    // Update brand's product count
    const updatedBrand = await Brand.findByIdAndUpdate(
      product.brandId, 
      { $inc: { productCount: -1 } },
      { new: true }
    );
    
    // Automatically delete brand if it has no products left
    if (updatedBrand && updatedBrand.productCount <= 0) {
      await Brand.findByIdAndDelete(product.brandId);
      console.log(`Brand "${updatedBrand.name}" automatically deleted as it has no products`);
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET /api/products/brands/unique - Get unique brand names for filtering
router.get('/brands/unique', async (req, res) => {
  try {
    const brands = await Brand.find({}, 'name').sort({ name: 1 });
    const brandNames = brands.map(brand => brand.name);
    res.json(brandNames);
  } catch (error) {
    console.error('Error fetching unique brand names:', error);
    res.status(500).json({ error: 'Failed to fetch brand names' });
  }
});

// ==================== PRODUCT ANALYTICS ROUTES ====================

// GET /api/products/analytics/overview - Get comprehensive product analytics
router.get('/analytics/overview', async (req, res) => {
  try {
    const analytics = await Product.getProductAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({ error: 'Failed to fetch product analytics' });
  }
});

// GET /api/products/analytics/brand/:brandName - Get product performance by specific brand
router.get('/analytics/brand/:brandName', async (req, res) => {
  try {
    const { brandName } = req.params;
    const brandAnalytics = await Product.getProductPerformanceByBrand(brandName);
    res.json(brandAnalytics);
  } catch (error) {
    console.error('Error fetching brand analytics:', error);
    res.status(500).json({ error: 'Failed to fetch brand analytics' });
  }
});

// GET /api/products/analytics/trends - Get product trends over time
router.get('/analytics/trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trends = await Product.getProductTrends(parseInt(days));
    res.json(trends);
  } catch (error) {
    console.error('Error fetching product trends:', error);
    res.status(500).json({ error: 'Failed to fetch product trends' });
  }
});

// GET /api/products/analytics/popular - Get most popular products
router.get('/analytics/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const Order = require('../models/Order');
    
    const popularProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            productName: '$items.productName',
            brandName: '$items.brandName'
          },
          orderCount: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' },
          avgQuantityPerOrder: { $avg: '$items.quantity' }
        }
      },
      {
        $sort: { orderCount: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);
    
    res.json(popularProducts);
  } catch (error) {
    console.error('Error fetching popular products:', error);
    res.status(500).json({ error: 'Failed to fetch popular products' });
  }
});

// GET /api/products/analytics/brand-performance - Get brand performance analytics
router.get('/analytics/brand-performance', async (req, res) => {
  try {
    const Order = require('../models/Order');
    
    const brandPerformance = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.brandName',
          orderCount: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
          uniqueProducts: { $addToSet: '$items.productName' }
        }
      },
      {
        $addFields: {
          uniqueProductCount: { $size: '$uniqueProducts' }
        }
      },
      {
        $project: {
          uniqueProducts: 0 // Remove the array from response
        }
      },
      {
        $sort: { orderCount: -1 }
      }
    ]);
    
    res.json(brandPerformance);
  } catch (error) {
    console.error('Error fetching brand performance:', error);
    res.status(500).json({ error: 'Failed to fetch brand performance' });
  }
});

// GET /api/products/analytics/product-distribution - Get product distribution by brand
router.get('/analytics/product-distribution', async (req, res) => {
  try {
    const productDistribution = await Product.aggregate([
      {
        $group: {
          _id: '$brandName',
          productCount: { $sum: 1 },
          products: {
            $push: {
              name: '$name',
              id: '$_id'
            }
          }
        }
      },
      {
        $sort: { productCount: -1 }
      }
    ]);
    
    res.json(productDistribution);
  } catch (error) {
    console.error('Error fetching product distribution:', error);
    res.status(500).json({ error: 'Failed to fetch product distribution' });
  }
});

// GET /api/products/analytics/recent-activity - Get recent product activity
router.get('/analytics/recent-activity', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const Order = require('../models/Order');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const recentActivity = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            productName: '$items.productName',
            brandName: '$items.brandName'
          },
          recentOrderCount: { $sum: 1 },
          recentQuantity: { $sum: '$items.quantity' },
          lastOrderDate: { $max: '$createdAt' }
        }
      },
      {
        $sort: { recentOrderCount: -1 }
      },
      {
        $limit: 20
      }
    ]);
    
    res.json(recentActivity);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

module.exports = router;
