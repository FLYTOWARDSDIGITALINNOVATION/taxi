import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  bookingId: { type: String },
  recipient: { type: String, required: true },   // 'customer' | 'driver'
  recipientName: { type: String, required: true },
  recipientPhone: { type: String, required: true },
  messageType: {
    type: String,
    enum: ['booking_confirmed', 'trip_assigned', 'trip_closed'],
    required: true
  },
  messageBody: { type: String, required: true },
  // Trip details snapshot
  pickup: { type: String },
  drop: { type: String },
  driverName: { type: String },
  driverPhone: { type: String },
  vehicleType: { type: String },
  tripDate: { type: String },
  // Closure details
  km: { type: Number },
  duration: { type: String },
  total: { type: Number },
  sentAt: { type: Date, default: Date.now },
  // Twilio status tracking
  twilioSid: { type: String },
  status: { type: String, default: 'pending' },
  errorCode: { type: Number },
  errorMessage: { type: String }
});

export const Message = mongoose.model('Message', messageSchema);
