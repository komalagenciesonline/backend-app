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

    const products = await Product.find(query);
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
      await Brand.findByIdAndUpdate(product.brandId, { $inc: { productCount: -1 } });
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
    await Brand.findByIdAndUpdate(product.brandId, { $inc: { productCount: -1 } });
    
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

module.exports = router;
