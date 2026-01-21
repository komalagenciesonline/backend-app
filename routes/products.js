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

    const products = await Product.find(query)
      .sort({ order: 1, createdAt: 1 })
      .select('-__v'); // Exclude version key
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
    // Use distinct for better performance instead of fetching all brands
    const brandNames = await Brand.distinct('name');
    res.json(brandNames.sort()); // Sort alphabetically
  } catch (error) {
    console.error('Error fetching unique brand names:', error);
    res.status(500).json({ error: 'Failed to fetch brand names' });
  }
});

module.exports = router;
