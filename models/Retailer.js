const mongoose = require('mongoose');

const retailerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Basic phone validation - allows various formats
        return /^[\+]?[0-9\s\-\(\)]{10,}$/.test(v);
      },
      message: 'Please enter a valid phone number'
    }
  },
  bit: {
    type: String,
    required: true,
    trim: true,
    enum: [
      'Turori',
      'Naldurg & Jalkot',
      'Gunjoti & Murum',
      'Dalimb & Yenegur',
      'Sastur & Makhani',
      'Narangwadi & Killari',
      'Andur',
      'Omerga'
    ]
  }
}, {
  timestamps: true
});

// Index for better search performance
retailerSchema.index({ name: 'text', phone: 'text', bit: 'text' });
retailerSchema.index({ bit: 1 });
retailerSchema.index({ phone: 1 });

module.exports = mongoose.model('Retailer', retailerSchema);
