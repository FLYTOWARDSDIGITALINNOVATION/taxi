import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { initializeWhatsApp, sendCustomerNotification } from './utils/whatsappService.js';

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/taxi_db';

console.log('Connecting to MongoDB...');
await mongoose.connect(MONGODB_URI);
console.log('Connected to MongoDB!');

// Initialize the Twilio client
initializeWhatsApp();

const booking = { 
  bookingId: 'BK-TEST',
  phone: '+919600989735', // Use a real number if you want to test receiving it
  customer: 'Test Customer', 
  date: new Date() 
};
const taxi = { model: 'Toyota Camry', taxiNumber: 'TX-001', type: 'Sedan' };
const driver = { name: 'Alex Johnson', phone: '+919600989735' };

console.log('Sending test customer notification...');
try {
  await sendCustomerNotification(booking, taxi, driver);
  console.log('Test notification run completed!');
} catch (err) {
  console.error('Error during test notification run:', err);
} finally {
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
  process.exit(0);
}
