import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { Message } from '../models/Message.js';

/**
 * Message Notification Service (Free WhatsApp Integration)
 * Logs all messages to the database for the in-app message inbox.
 * Sends real messages via WhatsApp Web API.
 */

let waClient = null;
let isWaConnected = false;

export const initializeWhatsApp = () => {
  waClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
    }
  });

  waClient.on('qr', (qr) => {
    console.log('\n\n======================================================');
    console.log('📱 SCAN THIS QR CODE IN WHATSAPP TO LINK YOUR ACCOUNT 📱');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });
  });

  waClient.on('ready', () => {
    isWaConnected = true;
    console.log('\n✅ WhatsApp Client is READY and linked!');
  });

  waClient.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated!');
  });

  waClient.on('auth_failure', msg => {
    console.error('❌ WhatsApp Authentication failure', msg);
  });

  waClient.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Client was disconnected', reason);
    isWaConnected = false;
  });

  waClient.initialize();
};

const formatPhone = (phone) => {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (!clean.startsWith('91')) {
    clean = '91' + clean;
  }
  return `${clean}@c.us`;
};

// ── Booking Confirmed (sent to customer) ──────────────────────────────────────
export const sendBookingConfirmedMessage = async ({ bookingId, customerName, customerPhone, pickup, drop, date, vehicleType }) => {
  const body = `Hi ${customerName}, your Nanban Taxi booking is confirmed.\nPickup: ${pickup}\nDrop: ${drop}\nDate/Time: ${date}\nVehicle Type: ${vehicleType}\nThank you for choosing Nanban Taxi +91 9600989735.`;

  await Message.create({
    bookingId,
    recipient: 'customer',
    recipientName: customerName,
    recipientPhone: customerPhone,
    messageType: 'booking_confirmed',
    messageBody: body,
    pickup,
    drop,
    tripDate: date,
    vehicleType,
  });

  console.log(`[MSG] Booking Confirmed → ${customerName} (${customerPhone})`);
  _tryWhatsApp(formatPhone(customerPhone), body);
  return true;
};

// ── Trip Assigned (sent to customer & driver) ─────────────────────────────────
export const sendCustomerNotification = async (booking, taxi, driver) => {
  const dateStr = new Date(booking.date).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const body = `Hello ${booking.customer}, your trip from ${booking.pickup} to ${booking.drop} has been assigned.\nDriver: ${driver.name} (${driver.phone}).\n- Nanban Taxi`;

  await Message.create({
    bookingId: booking.bookingId,
    recipient: 'customer',
    recipientName: booking.customer,
    recipientPhone: booking.phone,
    messageType: 'trip_assigned',
    messageBody: body,
    pickup: booking.pickup,
    drop: booking.drop,
    driverName: driver.name,
    driverPhone: driver.phone,
    vehicleType: taxi?.type || taxi?.model || '',
    tripDate: dateStr,
  });

  console.log(`[MSG] Trip Assigned (Customer) → ${booking.customer} (${booking.phone})`);
  _tryWhatsApp(formatPhone(booking.phone), body);
  return true;
};

export const sendDriverNotification = async (booking, taxi, driver) => {
  const dateStr = new Date(booking.date).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const body = `Trip Assigned:\nCustomer: ${booking.customer} (${booking.phone})\nPickup: ${booking.pickup}\nDrop: ${booking.drop}\nTime: ${dateStr}`;

  await Message.create({
    bookingId: booking.bookingId,
    recipient: 'driver',
    recipientName: driver.name,
    recipientPhone: driver.phone,
    messageType: 'trip_assigned',
    messageBody: body,
    pickup: booking.pickup,
    drop: booking.drop,
    driverName: driver.name,
    driverPhone: driver.phone,
    vehicleType: taxi?.type || taxi?.model || '',
    tripDate: dateStr,
  });

  console.log(`[MSG] Trip Assigned (Driver) → ${driver.name} (${driver.phone})`);
  _tryWhatsApp(formatPhone(driver.phone), body);
  return true;
};

// ── Trip Closed (sent to customer) ────────────────────────────────────────────
export const sendTripClosedMessage = async ({ bookingId, customerName, customerPhone, pickup, drop, km, duration, total }) => {
  const body = `Hi ${customerName}, your trip with Nanban Taxi is closed.\nKM: ${km}\nDuration: ${duration} hrs\nTotal: ₹${total}`;

  await Message.create({
    bookingId,
    recipient: 'customer',
    recipientName: customerName,
    recipientPhone: customerPhone,
    messageType: 'trip_closed',
    messageBody: body,
    pickup,
    drop,
    km,
    duration,
    total,
  });

  console.log(`[MSG] Trip Closed → ${customerName} (${customerPhone})`);
  _tryWhatsApp(formatPhone(customerPhone), body);
  return true;
};

// ── Internal: send real WhatsApp message ──────────────────────────────────────
async function _tryWhatsApp(chatId, body) {
  if (!isWaConnected || !waClient) {
    console.log(`[WhatsApp Warning] Message not sent. WhatsApp is not connected yet.`);
    return;
  }
  if (!chatId) return;

  try {
    await waClient.sendMessage(chatId, body);
    console.log(`✅ Real WhatsApp Message sent to ${chatId}`);
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp message to ${chatId}:`, err.message);
  }
}
