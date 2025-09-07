const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brandId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true
  },
  brandName: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

// Index for better search performance
productSchema.index({ name: 'text', brandName: 'text' });
productSchema.index({ brandId: 1 });

module.exports = mongoose.model('Product', productSchema);
