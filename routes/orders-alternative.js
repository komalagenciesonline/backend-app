// Alternative solution using MongoDB Counter Collection
// This is a more robust approach using a separate counter collection

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const mongoose = require('mongoose');

// Counter schema for atomic order number generation
const counterSchema = new mongoose.Schema({
  _id: String,
  sequence_value: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

// Helper function to get next order number atomically
async function getNextOrderNumber() {
  const result = await Counter.findByIdAndUpdate(
    'orderNumber',
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  return `ORD-${String(result.sequence_value).padStart(3, '0')}`;
}

// POST /api/orders - Create new order (Alternative implementation)
router.post('/', async (req, res) => {
  try {
    const { counterName, bit, totalItems, totalAmount, items } = req.body;

    // Validation
    if (!counterName || !bit || totalItems === undefined || totalAmount === undefined) {
      return res.status(400).json({ 
        error: 'counterName, bit, totalItems, and totalAmount are required' 
      });
    }

    // Get current date
    const now = new Date();
    const date = now.toLocaleDateString('en-GB'); // DD/MM/YYYY format
    const time = now.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Generate unique order number atomically
    const orderNumber = await getNextOrderNumber();

    const order = new Order({
      counterName: counterName.trim(),
      bit: bit.trim(),
      totalItems,
      totalAmount,
      date,
      time,
      status: 'Pending',
      orderNumber,
      items: items || []
    });

    const savedOrder = await order.save();
    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

module.exports = router;
