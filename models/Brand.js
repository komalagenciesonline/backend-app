const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  productCount: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better search performance
brandSchema.index({ name: 'text' });

module.exports = mongoose.model('Brand', brandSchema);
