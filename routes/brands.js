const express = require('express');
const router = express.Router();
const Brand = require('../models/Brand');

// GET /api/brands - Get all brands
router.get('/', async (req, res) => {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    res.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// GET /api/brands/:id - Get brand by ID
router.get('/:id', async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json(brand);
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({ error: 'Failed to fetch brand' });
  }
});

// POST /api/brands - Create new brand
router.post('/', async (req, res) => {
  try {
    const { name, image } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    // Check if brand already exists
    const existingBrand = await Brand.findOne({ name: name.trim() });
    if (existingBrand) {
      return res.status(400).json({ error: 'Brand already exists' });
    }

    const brand = new Brand({
      name: name.trim(),
      productCount: 0,
      image: image || `https://via.placeholder.com/100x100?text=${encodeURIComponent(name.trim())}`
    });

    const savedBrand = await brand.save();
    res.status(201).json(savedBrand);
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

// PUT /api/brands/:id - Update brand
router.put('/:id', async (req, res) => {
  try {
    const { name, image } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Check if new name already exists (excluding current brand)
    const existingBrand = await Brand.findOne({ 
      name: name.trim(), 
      _id: { $ne: req.params.id } 
    });
    if (existingBrand) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }

    const updatedBrand = await Brand.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        image: image || brand.image
      },
      { new: true }
    );

    res.json(updatedBrand);
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ error: 'Failed to update brand' });
  }
});

// DELETE /api/brands/:id - Delete brand
router.delete('/:id', async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id);
    
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Check if brand has products
    if (brand.productCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete brand with existing products. Please delete all products first.' 
      });
    }

    await Brand.findByIdAndDelete(req.params.id);
    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: 'Failed to delete brand' });
  }
});

module.exports = router;
