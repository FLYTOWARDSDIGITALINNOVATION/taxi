import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { Booking } from './models/Booking.js';
import { Driver } from './models/Driver.js';
import { Taxi } from './models/Taxi.js';
import { Message } from './models/Message.js';
import { sendCustomerNotification, sendDriverNotification, sendTripClosedMessage, sendBookingConfirmedMessage, initializeWhatsApp, getWhatsAppStatus, restartWhatsApp } from './utils/whatsappService.js';


dotenv.config();

// Initialize WhatsApp client
initializeWhatsApp();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- ROUTES ---

// Dashboard Stats
app.get('/api/stats', async (req, res) => {
  try {
    const bookingsTotal = await Booking.countDocuments();
    const bookingsActive = await Booking.countDocuments({ status: { $in: ['Pending', 'Assigned', 'On Trip'] } });
    
    const tripsTotal = await Booking.countDocuments({ status: { $in: ['Assigned', 'On Trip', 'Completed'] } });
    const tripsActive = await Booking.countDocuments({ status: 'On Trip' });
    
    const driversTotal = await Driver.countDocuments();
    const driversActive = await Driver.countDocuments({ status: 'On Trip' });
    
    const taxisTotal = await Taxi.countDocuments();
    const taxisActive = await Taxi.countDocuments({ status: 'On Trip' });

    res.json({
      bookings: { total: bookingsTotal, active: bookingsActive },
      trips: { total: tripsTotal, active: tripsActive },
      drivers: { total: driversTotal, active: driversActive },
      taxis: { total: taxisTotal, active: taxisActive },
      trends: { totalBookings: '+12%' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp Status
app.get('/api/whatsapp/status', (req, res) => {
  try {
    const status = getWhatsAppStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp Restart
app.post('/api/whatsapp/restart', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    await restartWhatsApp(phoneNumber);
    res.json({ success: true, message: 'WhatsApp client is restarting...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('taxi')
      .populate('driver')
      .sort({ date: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings/recent', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('taxi')
      .populate('driver')
      .sort({ date: -1 })
      .limit(5);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications/upcoming', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const bookings = await Booking.find({
      date: { $gte: todayStart, $lte: tomorrowEnd },
      status: { $nin: ['Completed', 'Cancelled'] }
    }).populate('taxi').populate('driver').sort({ date: 1 });

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/bookings/:id/allocate', async (req, res) => {
  try {
    const { taxiId, driverId } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Verify availability
    const taxi = await Taxi.findById(taxiId);
    const driver = await Driver.findById(driverId);

    if (!taxi || taxi.status !== 'Available') {
      return res.status(400).json({ error: 'Selected taxi is no longer available' });
    }
    if (!driver || driver.status !== 'Available') {
      return res.status(400).json({ error: 'Selected driver is no longer available' });
    }

    booking.taxi = taxiId;
    booking.driver = driverId;
    booking.status = 'Assigned';
    await booking.save();

    // Update taxi and driver status
    await Taxi.findByIdAndUpdate(taxiId, { status: 'On Trip' });
    await Driver.findByIdAndUpdate(driverId, { status: 'On Trip' });

    // Send WhatsApp notifications
    try {
      await sendCustomerNotification(booking, taxi, driver);
      await sendDriverNotification(booking, taxi, driver);
    } catch (notifErr) {
      console.error('Notification Error:', notifErr);
      // We don't fail the request if notifications fail, but we log it
    }

    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Trip Status Update via WhatsApp Link
app.get('/api/trips/:id/update-status', async (req, res) => {
  try {
    const { status } = req.query;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) return res.status(404).send('Booking not found');

    if (status === 'On Trip') {
      booking.status = 'On Trip';
      if (booking.driver) await Driver.findByIdAndUpdate(booking.driver, { status: 'On Trip' });
      if (booking.taxi) await Taxi.findByIdAndUpdate(booking.taxi, { status: 'On Trip' });
    } else if (status === 'Completed') {
      booking.status = 'Completed';
      if (booking.driver) await Driver.findByIdAndUpdate(booking.driver, { status: 'Available' });
      if (booking.taxi) await Taxi.findByIdAndUpdate(booking.taxi, { status: 'Available' });
    }

    await booking.save();
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #10B981;">Success!</h1>
        <p>Trip status has been updated to <b>${status}</b>.</p>
        <p>You can now close this tab.</p>
      </div>
    `);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});


// ── CLOSE TRIP ──────────────────────────────────────────────────────────────
app.patch('/api/trips/:id/close', async (req, res) => {
  try {
    const { km, duration, total } = req.body;
    const booking = await Booking.findById(req.params.id).populate('driver').populate('taxi');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.status = 'Completed';
    if (booking.driver) await Driver.findByIdAndUpdate(booking.driver._id, { status: 'Available' });
    if (booking.taxi) await Taxi.findByIdAndUpdate(booking.taxi._id, { status: 'Available' });
    await booking.save();

    // Log trip closed message
    try {
      await sendTripClosedMessage({
        bookingId: booking.bookingId,
        customerName: booking.customer,
        customerPhone: booking.phone,
        pickup: booking.pickup,
        drop: booking.drop,
        km: km || 0,
        duration: duration || '0',
        total: total || 0
      });
    } catch (e) { console.error('Close msg error:', e.message); }

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MESSAGES INBOX ──────────────────────────────────────────────────────────
app.get('/api/messages', async (req, res) => {
  try {
    const { type, recipient, bookingId } = req.query;
    const filter = {};
    if (type) filter.messageType = type;
    if (recipient) filter.recipient = recipient;
    if (bookingId) filter.bookingId = bookingId;
    const messages = await Message.find(filter).sort({ sentAt: -1 }).limit(200);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages/stats', async (req, res) => {
  try {
    const total = await Message.countDocuments();
    const confirmed = await Message.countDocuments({ messageType: 'booking_confirmed' });
    const assigned = await Message.countDocuments({ messageType: 'trip_assigned' });
    const closed = await Message.countDocuments({ messageType: 'trip_closed' });
    res.json({ total, confirmed, assigned, closed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── BACKFILL: Generate messages for all existing bookings ─────────────────────
app.post('/api/messages/backfill', async (req, res) => {
  try {
    const bookings = await Booking.find().populate('driver').populate('taxi');
    let created = 0;

    for (const booking of bookings) {
      // Check if this booking already has messages
      const existing = await Message.countDocuments({ bookingId: booking.bookingId });
      if (existing > 0) continue;

      const dateStr = new Date(booking.date).toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      const vehicleType = booking.vehicleType || 'Tavara';
      const driverName = booking.driver?.name || 'Driver';
      const driverPhone = booking.driver?.phone || '';

      // 1. Always create booking_confirmed message for customer
      await Message.create({
        bookingId: booking.bookingId,
        recipient: 'customer',
        recipientName: booking.customer,
        recipientPhone: booking.phone,
        messageType: 'booking_confirmed',
        messageBody: `Hi ${booking.customer}, your Nanban Taxi booking is confirmed.\nPickup: ${booking.pickup}\nDrop: ${booking.drop}\nDate/Time: ${dateStr}\nVehicle Type: ${vehicleType}\nThank you for choosing Nanban Taxi 8015999100.`,
        pickup: booking.pickup,
        drop: booking.drop,
        tripDate: dateStr,
        vehicleType,
        sentAt: booking.date
      });
      created++;

      // 2. If driver is assigned, create trip_assigned messages
      if (booking.driver && ['Assigned', 'On Trip', 'Completed'].includes(booking.status)) {
        // To customer
        await Message.create({
          bookingId: booking.bookingId,
          recipient: 'customer',
          recipientName: booking.customer,
          recipientPhone: booking.phone,
          messageType: 'trip_assigned',
          messageBody: `Hello ${booking.customer}, your trip from ${booking.pickup} to ${booking.drop} has been assigned.\nDriver: ${driverName} (${driverPhone}).\n- Nanban Taxi`,
          pickup: booking.pickup,
          drop: booking.drop,
          driverName,
          driverPhone,
          vehicleType,
          tripDate: dateStr,
          sentAt: booking.date
        });
        created++;

        // To driver
        await Message.create({
          bookingId: booking.bookingId,
          recipient: 'driver',
          recipientName: driverName,
          recipientPhone: driverPhone,
          messageType: 'trip_assigned',
          messageBody: `Trip Assigned:\nCustomer: ${booking.customer} (${booking.phone})\nPickup: ${booking.pickup}\nDrop: ${booking.drop}\nTime: ${dateStr}`,
          pickup: booking.pickup,
          drop: booking.drop,
          driverName,
          driverPhone,
          vehicleType,
          tripDate: dateStr,
          sentAt: booking.date
        });
        created++;
      }

      // 3. If completed, create trip_closed message for customer
      if (booking.status === 'Completed') {
        await Message.create({
          bookingId: booking.bookingId,
          recipient: 'customer',
          recipientName: booking.customer,
          recipientPhone: booking.phone,
          messageType: 'trip_closed',
          messageBody: `Hi ${booking.customer}, your trip with ${driverName} is closed.\nKM: –\nDuration: –\nTotal: –`,
          pickup: booking.pickup,
          drop: booking.drop,
          sentAt: booking.date
        });
        created++;
      }
    }

    res.json({ success: true, messagesCreated: created, bookingsProcessed: bookings.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const lastBooking = await Booking.findOne().sort({ bookingId: -1 });

    const lastId = lastBooking ? parseInt(lastBooking.bookingId.split('-')[1]) : 1000;
    const newBookingId = `BK-${lastId + 1}`;

    const newBooking = new Booking({
      ...req.body,
      bookingId: newBookingId
    });
    await newBooking.save();

    // Generate and log the booking confirmed message
    try {
      const dateStr = new Date(newBooking.date).toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
      await sendBookingConfirmedMessage({
        bookingId: newBooking.bookingId,
        customerName: newBooking.customer,
        customerPhone: newBooking.phone,
        pickup: newBooking.pickup,
        drop: newBooking.drop,
        date: dateStr,
        vehicleType: newBooking.vehicleType || 'Tavara' // Default to Tavara if not specified
      });
    } catch (e) {
      console.error('Error logging booking confirmed message:', e.message);
    }

    res.status(201).json(newBooking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Drivers
app.get('/api/drivers', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const drivers = await Driver.find(query);
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drivers', async (req, res) => {
  try {
    const newDriver = new Driver(req.body);
    await newDriver.save();
    res.status(201).json(newDriver);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/drivers/:id', async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json({ message: 'Driver deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Taxis
app.get('/api/taxis', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const taxis = await Taxi.find(query);
    res.json(taxis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/taxis', async (req, res) => {
  try {
    const newTaxi = new Taxi(req.body);
    await newTaxi.save();
    res.status(201).json(newTaxi);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/taxis/:id', async (req, res) => {
  try {
    const taxi = await Taxi.findByIdAndDelete(req.params.id);
    if (!taxi) return res.status(404).json({ error: 'Taxi not found' });
    res.json({ message: 'Taxi deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Taxi App Backend is running...');
});

// --- SEED DATA ---
const seedData = async () => {
  const bookingCount = await Booking.countDocuments();
  if (bookingCount === 0) {
    await Booking.insertMany([
      { bookingId: 'BK-1023', customer: 'John Doe', phone: '+1 234 567 890', pickup: '123 Main St', drop: '456 Park Ave', status: 'Completed' },
      { bookingId: 'BK-1024', customer: 'Sarah Miller', phone: '+1 987 654 321', pickup: '789 Oak Rd', drop: '321 Pine St', status: 'Pending' },
      { bookingId: 'BK-1025', customer: 'Robert Wilson', phone: '+1 555 123 456', pickup: '555 Elm St', drop: '777 Cedar Ln', status: 'Completed' },
      { bookingId: 'BK-1026', customer: 'Emma Thompson', phone: '+1 222 333 444', pickup: '111 Maple Ave', drop: '999 Willow Dr', status: 'Cancelled' },
    ]);
    console.log('Seeded Bookings');
  }

  const driverCount = await Driver.countDocuments();
  if (driverCount === 0) {
    await Driver.insertMany([
      { name: 'Alex Johnson', phone: '+1 222 333 444', status: 'Available', rating: 4.8 },
      { name: 'Mike Ross', phone: '+1 555 666 777', status: 'On Trip', rating: 4.9 },
      { name: 'Harvey Specter', phone: '+1 999 888 777', status: 'Available', rating: 5.0 },
    ]);
    console.log('Seeded Drivers');
  }

  const taxiCount = await Taxi.countDocuments();
  if (taxiCount === 0) {
    await Taxi.insertMany([
      { model: 'Toyota Camry', taxiNumber: 'TX-001', type: 'Sedan', status: 'Available' },
      { model: 'Honda CR-V', taxiNumber: 'TX-002', type: 'SUV', status: 'On Trip' },
      { model: 'Mercedes S-Class', taxiNumber: 'TX-003', type: 'Luxury', status: 'Available' },
    ]);
    console.log('Seeded Taxis');
  }
};

// --- DB CONNECTION ---
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/taxi_db';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // await seedData(); // Disabled seeding so user can enter own data
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
