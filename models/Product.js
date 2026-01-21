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
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better search performance
productSchema.index({ name: 'text', brandName: 'text' });
productSchema.index({ brandId: 1 });
productSchema.index({ brandName: 1 }); // Add index for brand filtering
productSchema.index({ order: 1, createdAt: 1 }); // Compound index for sorting

// Analytics methods
productSchema.statics.getProductAnalytics = async function() {
  try {
    const Order = require('./Order');
    
    // Get total products count
    const totalProducts = await this.countDocuments();
    
    // Get products by brand distribution
    const productsByBrand = await this.aggregate([
      {
        $group: {
          _id: '$brandName',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Get most popular products (based on order frequency)
    const popularProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            productName: '$items.productName',
            brandName: '$items.brandName'
          },
          orderCount: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' }
        }
      },
      {
        $sort: { orderCount: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    
    // Get product trends over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const productTrends = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            productName: '$items.productName',
            brandName: '$items.brandName',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            }
          },
          dailyQuantity: { $sum: '$items.quantity' }
        }
      },
      {
        $group: {
          _id: {
            productName: '$_id.productName',
            brandName: '$_id.brandName'
          },
          totalQuantity: { $sum: '$dailyQuantity' },
          activeDays: { $sum: 1 }
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: 15
      }
    ]);
    
    return {
      totalProducts,
      productsByBrand,
      popularProducts,
      productTrends
    };
  } catch (error) {
    throw new Error(`Failed to get product analytics: ${error.message}`);
  }
};

productSchema.statics.getProductPerformanceByBrand = async function(brandName) {
  try {
    const Order = require('./Order');
    
    const brandAnalytics = await Order.aggregate([
      { $unwind: '$items' },
      {
        $match: {
          'items.brandName': brandName
        }
      },
      {
        $group: {
          _id: '$items.productName',
          orderCount: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' },
          avgQuantityPerOrder: { $avg: '$items.quantity' }
        }
      },
      {
        $sort: { orderCount: -1 }
      }
    ]);
    
    return brandAnalytics;
  } catch (error) {
    throw new Error(`Failed to get brand analytics: ${error.message}`);
  }
};

productSchema.statics.getProductTrends = async function(days = 30) {
  try {
    const Order = require('./Order');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const trends = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            productName: '$items.productName',
            brandName: '$items.brandName'
          },
          dailyQuantity: { $sum: '$items.quantity' },
          dailyOrders: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: '$dailyQuantity' },
          totalOrders: { $sum: '$dailyOrders' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    return trends;
  } catch (error) {
    throw new Error(`Failed to get product trends: ${error.message}`);
  }
};

module.exports = mongoose.model('Product', productSchema);
