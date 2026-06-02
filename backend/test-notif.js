import dotenv from 'dotenv';
dotenv.config();
import { sendCustomerNotification } from './utils/whatsappService.js';

const booking = { phone: '+919876543210', customer: 'Random', _id: '123' };
const taxi = { model: 'T', taxiNumber: '1' };
const driver = { name: 'D', phone: '+919876543210' };

sendCustomerNotification(booking, taxi, driver);
