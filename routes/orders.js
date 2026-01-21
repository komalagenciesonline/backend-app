const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const crypto = require('crypto');

// GET /api/orders - Get all orders with optional filtering
router.get('/', async (req, res) => {
  try {
    const { bit, status, search } = req.query;
    let query = {};

    // Filter by bit if specified
    if (bit && bit !== 'all') {
      query.bit = bit;
    }

    // Filter by status if specified
    if (status) {
      query.status = status;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { counterName: { $regex: search, $options: 'i' } },
        { orderNumber: { $regex: search, $options: 'i' } },
        { bit: { $regex: search, $options: 'i' } }
      ];
    }

    // No populate needed - productName and brandName are already stored in items
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .select('-__v'); // Exclude version key
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/pending-items - Get pending order items grouped by unit type
// IMPORTANT: This must be before /:id route to avoid route conflicts
router.get('/pending-items', async (req, res) => {
  try {
    const { brand, bit } = req.query;
    
    // Build match query for aggregation
    const matchQuery = { status: 'Pending' };
    if (bit && bit !== 'all') {
      matchQuery.bit = bit;
    }
    if (brand && brand !== 'all') {
      matchQuery['items.brandName'] = brand;
    }
    
    // Use MongoDB aggregation pipeline for much better performance
    const pipeline = [
      { $match: matchQuery },
      { $unwind: '$items' },
      // Filter by brand at database level if specified
      ...(brand && brand !== 'all' ? [{ $match: { 'items.brandName': brand } }] : []),
      {
        $group: {
          _id: {
            productId: '$items.productId',
            unit: '$items.unit'
          },
          productName: { $first: '$items.productName' },
          brandName: { $first: '$items.brandName' },
          unit: { $first: '$items.unit' },
          totalQuantity: { $sum: '$items.quantity' },
          orderCount: { $sum: 1 },
          orderNumbers: { $addToSet: '$orderNumber' }
        }
      },
      {
        $project: {
          _id: 0,
          productId: '$_id.productId',
          productName: 1,
          brandName: 1,
          unit: 1,
          totalQuantity: 1,
          orderCount: 1,
          orderNumbers: 1
        }
      }
    ];
    
    const aggregatedItems = await Order.aggregate(pipeline);
    
    // Convert productId to string and group by unit type in memory (small dataset now)
    const itemsWithStringId = aggregatedItems.map(item => ({
      ...item,
      productId: item.productId.toString()
    }));
    
    // Group by unit type
    const groupedByUnit = {
      Pc: itemsWithStringId.filter(item => item.unit === 'Pc').sort((a, b) => b.totalQuantity - a.totalQuantity),
      Outer: itemsWithStringId.filter(item => item.unit === 'Outer').sort((a, b) => b.totalQuantity - a.totalQuantity),
      Case: itemsWithStringId.filter(item => item.unit === 'Case').sort((a, b) => b.totalQuantity - a.totalQuantity)
    };
    
    // Get total orders count (separate efficient query)
    const totalOrdersCount = await Order.countDocuments(matchQuery);
    
    // Calculate totals
    const totals = {
      Pc: groupedByUnit.Pc.reduce((sum, item) => sum + item.totalQuantity, 0),
      Outer: groupedByUnit.Outer.reduce((sum, item) => sum + item.totalQuantity, 0),
      Case: groupedByUnit.Case.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalItems: itemsWithStringId.length,
      totalOrders: totalOrdersCount
    };
    
    res.json({
      items: groupedByUnit,
      totals
    });
  } catch (error) {
    console.error('Error fetching pending order items:', error);
    res.status(500).json({ error: 'Failed to fetch pending order items' });
  }
});

// GET /api/orders/stats/dashboard - Get dashboard statistics
// IMPORTANT: This must be before /:id route to avoid route conflicts
router.get('/stats/dashboard', async (req, res) => {
  try {
    // Use aggregation for better performance instead of fetching all orders
    const [totalOrders, pendingOrders, uniqueProductsResult] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'Pending' }),
      Order.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: {
              productName: '$items.productName',
              brandName: '$items.brandName'
            }
          }
        },
        { $count: 'total' }
      ])
    ]);

    const totalItems = uniqueProductsResult[0]?.total || 0;

    // Hardcoded bits count (same as frontend)
    const totalBits = 8;

    res.json({
      totalOrders,
      totalItems,
      pendingOrders,
      totalBits
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// GET /api/orders/recent/:limit - Get recent orders
// IMPORTANT: This must be before /:id route to avoid route conflicts
router.get('/recent/:limit', async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 3;
    
    // No populate needed - productName and brandName are already stored in items
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v'); // Exclude version key
    
    res.json(recentOrders);
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

// Helper function to generate a random unique order number
function generateOrderNumber() {
  // Generate a random 8-character hex string
  // Format: ORD-XXXXXXXX where X is a hex character (0-9, A-F)
  // This gives 16^8 = 4.3 billion possible combinations, minimizing collisions
  const randomId = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ORD-${randomId}`;
}

// GET /api/orders/:id - Get order by ID
// IMPORTANT: This must be LAST to avoid catching other routes
router.get('/:id', async (req, res) => {
  try {
    // No populate needed - productName and brandName are already stored in items
    const order = await Order.findById(req.params.id)
      .select('-__v'); // Exclude version key
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// POST /api/orders - Create new order
router.post('/', async (req, res) => {
  try {
    const { counterName, bit, totalItems, totalAmount, items, orderDate } = req.body;

    // Validation
    if (!counterName || !bit || totalItems === undefined || totalAmount === undefined) {
      return res.status(400).json({ 
        error: 'counterName, bit, totalItems, and totalAmount are required' 
      });
    }

    // Use provided orderDate or current date
    let date, time;
    if (orderDate) {
      const selectedDate = new Date(orderDate);
      date = selectedDate.toLocaleDateString('en-GB'); // DD/MM/YYYY format
      time = selectedDate.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      const now = new Date();
      date = now.toLocaleDateString('en-GB'); // DD/MM/YYYY format
      time = now.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }

    // Generate random unique order number
    let orderNumber;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        orderNumber = generateOrderNumber();
        
        // Create the order with the generated number
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
        return; // Success, exit the function
        
      } catch (error) {
        // If duplicate key error, try again with a new random number
        if (error.code === 11000 && error.keyPattern && error.keyPattern.orderNumber) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error('Unable to generate unique order number after multiple attempts');
          }
          continue; // Try again with new random number
        } else {
          // Other error, throw it
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error creating order:', error);
    if (error.message && error.message.includes('Unable to generate unique order number')) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create order' });
    }
  }
});

// PUT /api/orders/:id - Update order
router.put('/:id', async (req, res) => {
  try {
    // Use findByIdAndUpdate directly - no need for separate find query
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// PATCH /api/orders/:id/status - Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['Pending', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    // Use findByIdAndUpdate directly - no need for separate find query
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// DELETE /api/orders/:id - Delete order
router.delete('/:id', async (req, res) => {
  try {
    // Use findByIdAndDelete directly - returns null if not found
    const deletedOrder = await Order.findByIdAndDelete(req.params.id);
    
    if (!deletedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// POST /api/orders/cleanup/old-completed - Delete old completed orders (31+ days old)
router.post('/cleanup/old-completed', async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ error: 'orderIds array is required' });
    }

    // Verify that all orders are completed and 31+ days old
    const today = new Date();
    const thirtyOneDaysAgo = new Date(today);
    thirtyOneDaysAgo.setDate(today.getDate() - 31);

    const orders = await Order.find({ _id: { $in: orderIds } });
    
    // Filter to ensure only completed orders older than 31 days are deleted
    const validOrderIds = orders
      .filter(order => {
        if (order.status !== 'Completed') return false;
        
        // Parse the date (format: DD/MM/YYYY)
        const [day, month, year] = order.date.split('/');
        const orderDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        return orderDate <= thirtyOneDaysAgo;
      })
      .map(order => order._id);

    // Delete the valid orders
    const result = await Order.deleteMany({ _id: { $in: validOrderIds } });

    res.json({
      message: 'Old completed orders deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting old completed orders:', error);
    res.status(500).json({ error: 'Failed to delete old completed orders' });
  }
});

module.exports = router;
