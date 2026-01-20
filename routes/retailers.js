const express = require('express');
const router = express.Router();
const Retailer = require('../models/Retailer');

// GET /api/retailers - Get all retailers with optional filtering
router.get('/', async (req, res) => {
  try {
    const { bit, search } = req.query;
    let query = {};

    // Filter by bit if specified
    if (bit && bit !== 'all') {
      query.bit = bit;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { bit: { $regex: search, $options: 'i' } }
      ];
    }

    const retailers = await Retailer.find(query).sort({ name: 1 });
    res.json(retailers);
  } catch (error) {
    console.error('Error fetching retailers:', error);
    res.status(500).json({ error: 'Failed to fetch retailers' });
  }
});

// GET /api/retailers/:id - Get retailer by ID
router.get('/:id', async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.params.id);
    
    if (!retailer) {
      return res.status(404).json({ error: 'Retailer not found' });
    }
    
    res.json(retailer);
  } catch (error) {
    console.error('Error fetching retailer:', error);
    res.status(500).json({ error: 'Failed to fetch retailer' });
  }
});

// POST /api/retailers - Create new retailer
router.post('/', async (req, res) => {
  try {
    const { name, phone, bit } = req.body;

    // Validation
    if (!name || !phone || !bit) {
      return res.status(400).json({ error: 'Name, phone, and bit are required' });
    }

    // Check if retailer with same phone already exists
    const existingRetailer = await Retailer.findOne({ phone: phone.trim() });
    if (existingRetailer) {
      return res.status(400).json({ error: 'Retailer with this phone number already exists' });
    }

    const retailer = new Retailer({
      name: name.trim(),
      phone: phone.trim(),
      bit: bit.trim()
    });

    const savedRetailer = await retailer.save();
    res.status(201).json(savedRetailer);
  } catch (error) {
    console.error('Error creating retailer:', error);
    // Handle duplicate key error (race condition - if unique constraint exists)
    if (error.code === 11000 || (error.name === 'MongoServerError' && error.code === 11000)) {
      return res.status(400).json({ error: 'Retailer with this phone number already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create retailer' });
  }
});

// PUT /api/retailers/:id - Update retailer
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, bit } = req.body;

    // Validation
    if (!name || !phone || !bit) {
      return res.status(400).json({ error: 'Name, phone, and bit are required' });
    }

    const retailer = await Retailer.findById(req.params.id);
    if (!retailer) {
      return res.status(404).json({ error: 'Retailer not found' });
    }

    // Check if phone number is being changed and if it already exists
    if (retailer.phone !== phone.trim()) {
      const existingRetailer = await Retailer.findOne({ 
        phone: phone.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingRetailer) {
        return res.status(400).json({ error: 'Retailer with this phone number already exists' });
      }
    }

    const updatedRetailer = await Retailer.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        phone: phone.trim(),
        bit: bit.trim()
      },
      { new: true }
    );

    res.json(updatedRetailer);
  } catch (error) {
    console.error('Error updating retailer:', error);
    // Handle duplicate key error (race condition - if unique constraint exists)
    if (error.code === 11000 || (error.name === 'MongoServerError' && error.code === 11000)) {
      return res.status(400).json({ error: 'Retailer with this phone number already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update retailer' });
  }
});

// DELETE /api/retailers/:id - Delete retailer
router.delete('/:id', async (req, res) => {
  try {
    const retailer = await Retailer.findById(req.params.id);
    
    if (!retailer) {
      return res.status(404).json({ error: 'Retailer not found' });
    }

    await Retailer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Retailer deleted successfully' });
  } catch (error) {
    console.error('Error deleting retailer:', error);
    res.status(500).json({ error: 'Failed to delete retailer' });
  }
});

// GET /api/retailers/bits/unique - Get unique bits for filtering
router.get('/bits/unique', async (req, res) => {
  try {
    const bits = await Retailer.distinct('bit');
    res.json(bits.sort());
  } catch (error) {
    console.error('Error fetching unique bits:', error);
    res.status(500).json({ error: 'Failed to fetch unique bits' });
  }
});

// GET /api/retailers/bit/:bit - Get retailers by specific bit
router.get('/bit/:bit', async (req, res) => {
  try {
    const retailers = await Retailer.find({ bit: req.params.bit }).sort({ name: 1 });
    res.json(retailers);
  } catch (error) {
    console.error('Error fetching retailers by bit:', error);
    res.status(500).json({ error: 'Failed to fetch retailers by bit' });
  }
});

module.exports = router;
