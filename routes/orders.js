const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

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

    const orders = await Order.find(query)
      .populate('items.productId', 'name brandName')
      .sort({ createdAt: -1 });
    
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
    // Get all pending orders
    const pendingOrders = await Order.find({ status: 'Pending' });
    
    // Aggregate items by product and unit type
    const itemsMap = new Map();
    
    pendingOrders.forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          // Create a unique key: productId + unit
          const key = `${item.productId}_${item.unit}`;
          
          if (itemsMap.has(key)) {
            const existing = itemsMap.get(key);
            existing.totalQuantity += item.quantity;
            existing.orderCount += 1;
            // Add order number to the list if not already present
            if (!existing.orderNumbers.includes(order.orderNumber)) {
              existing.orderNumbers.push(order.orderNumber);
            }
          } else {
            itemsMap.set(key, {
              productId: item.productId.toString(),
              productName: item.productName,
              brandName: item.brandName,
              unit: item.unit,
              totalQuantity: item.quantity,
              orderCount: 1,
              orderNumbers: [order.orderNumber]
            });
          }
        });
      }
    });
    
    // Convert map to array and group by unit type
    const allItems = Array.from(itemsMap.values());
    
    // Group by unit type
    const groupedByUnit = {
      Pc: allItems.filter(item => item.unit === 'Pc').sort((a, b) => b.totalQuantity - a.totalQuantity),
      Outer: allItems.filter(item => item.unit === 'Outer').sort((a, b) => b.totalQuantity - a.totalQuantity),
      Case: allItems.filter(item => item.unit === 'Case').sort((a, b) => b.totalQuantity - a.totalQuantity)
    };
    
    // Calculate totals
    const totals = {
      Pc: groupedByUnit.Pc.reduce((sum, item) => sum + item.totalQuantity, 0),
      Outer: groupedByUnit.Outer.reduce((sum, item) => sum + item.totalQuantity, 0),
      Case: groupedByUnit.Case.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalItems: allItems.length,
      totalOrders: pendingOrders.length
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
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'Pending' });
    
    // Calculate unique items across all orders
    const orders = await Order.find({}, 'items');
    const uniqueProducts = new Set();
    orders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          // Create a unique key using productName + brandName
          // since some items have null productId
          const uniqueKey = `${item.productName}-${item.brandName}`;
          uniqueProducts.add(uniqueKey);
        });
      }
    });
    const totalItems = uniqueProducts.size;

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
    
    const recentOrders = await Order.find()
      .populate('items.productId', 'name brandName')
      .sort({ createdAt: -1 })
      .limit(limit);
    
    res.json(recentOrders);
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

// GET /api/orders/:id - Get order by ID
// IMPORTANT: This must be LAST to avoid catching other routes
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.productId', 'name brandName');
    
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

    // Generate order number using atomic operation
    let orderNumber;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        // Get the highest existing order number
        const lastOrder = await Order.findOne({}, {}, { sort: { orderNumber: -1 } });
        let nextNumber = 1;
        
        if (lastOrder && lastOrder.orderNumber) {
          // Extract number from last order (e.g., "ORD-004" -> 4)
          const lastNumber = parseInt(lastOrder.orderNumber.split('-')[1]);
          nextNumber = lastNumber + 1;
        }
        
        orderNumber = `ORD-${String(nextNumber).padStart(3, '0')}`;
        
        // Try to create the order with this number
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
        if (error.code === 11000 && error.keyPattern && error.keyPattern.orderNumber) {
          // Duplicate key error, try again with next number
          attempts++;
          continue;
        } else {
          // Other error, throw it
          throw error;
        }
      }
    }
    
    // If we get here, we've exceeded max attempts
    throw new Error('Unable to generate unique order number after multiple attempts');
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PUT /api/orders/:id - Update order
router.put('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

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

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// DELETE /api/orders/:id - Delete order
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await Order.findByIdAndDelete(req.params.id);
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
