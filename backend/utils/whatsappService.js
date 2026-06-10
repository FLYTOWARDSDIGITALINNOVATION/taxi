import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { Message } from '../models/Message.js';
import fs from 'fs';
import path from 'path';

/**
 * Message Notification Service (Free WhatsApp Integration)
 * Logs all messages to the database for the in-app message inbox.
 * Sends real messages via WhatsApp Web API.
 */

let waClient = null;
let isWaConnected = false;
let latestQr = null;
let waStatus = 'initializing'; // initializing, qr_ready, connected, disconnected

export const getWhatsAppStatus = () => {
  return { status: waStatus, qr: latestQr };
};

let dynamicPairingNumber = null;

export const restartWhatsApp = async (phoneNumber) => {
  if (phoneNumber) {
    dynamicPairingNumber = phoneNumber;
  }
  
  console.log('🔄 Manual WhatsApp restart requested...');
  waStatus = 'initializing';
  latestQr = null;
  isWaConnected = false;

  if (waClient) {
    try {
      // Forcefully kill the specific background Chrome process to release file locks
      if (waClient.pupBrowser) {
        const browserProcess = waClient.pupBrowser.process();
        if (browserProcess) {
          browserProcess.kill('SIGKILL');
        }
      }
      await waClient.destroy();
    } catch (e) {
      console.log('Error destroying client:', e.message);
    }
  }
  
  // Give Windows 4 seconds to fully kill the chrome.exe process before deleting files
  setTimeout(() => {
    try {
      const authPath = path.join(process.cwd(), '.wwebjs_auth');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
    } catch (e) {
      console.log('Error clearing auth directory (this is usually fine, it means chrome is still running in background):', e.message);
    }

    initializeWhatsApp();
  }, 4000);
  
  return true;
};

export const initializeWhatsApp = () => {
  // Clear stale lockfiles to prevent EBUSY crash on VPS restarts
  try {
    const lockfile = path.join(process.cwd(), '.wwebjs_auth', 'session', 'lockfile');
    const singleton = path.join(process.cwd(), '.wwebjs_auth', 'session', 'SingletonLock');
    if (fs.existsSync(lockfile)) fs.unlinkSync(lockfile);
    if (fs.existsSync(singleton)) fs.unlinkSync(singleton);
  } catch (e) {
    console.log('[WhatsApp Warning] Could not remove lock files:', e.message);
  }

  waClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      // Use the bundled Chromium on non‑Windows or when the custom Chrome path is missing.
      ...(process.env.WHATSAPP_CHROME_PATH && fs.existsSync(process.env.WHATSAPP_CHROME_PATH)
        ? { executablePath: process.env.WHATSAPP_CHROME_PATH }
        : {}),
      // Server stability args
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions', '--disable-dev-shm-usage', '--disable-gpu']
    }, // end puppeteer config
    // Fix for "Runtime.callFunctionOn timed out" / "Execution context was destroyed"
    // webVersionCache: {
    //   type: 'remote',
    //   remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    // },
    authTimeoutMs: 60000,
    qrMaxRetries: 3
  });

  let pairingCodeRequested = false;

  waClient.on('qr', async (qr) => {
    latestQr = qr;
    waStatus = 'qr_ready';
    
    const pairingNumber = dynamicPairingNumber || process.env.WHATSAPP_PAIRING_NUMBER;
    
    if (pairingNumber && !pairingCodeRequested) {
      pairingCodeRequested = true;
      console.log(`\n📲 Preparing to request pairing code for: ${pairingNumber}...`);
      
      let code = null;
      let retries = 5;
      
      // Retry loop: Sometimes WhatsApp internal JS takes time to load.
      while (retries > 0) {
        try {
          await new Promise(resolve => setTimeout(resolve, 3000));
          code = await waClient.requestPairingCode(pairingNumber);
          break; // Success!
        } catch (err) {
          console.log(`⏳ WhatsApp web modules still loading... Retrying (${retries - 1} attempts left)`);
          retries--;
        }
      }

      if (code) {
        console.log('\n======================================================');
        console.log(`🔑 YOUR PAIRING CODE IS: ${code} 🔑`);
        console.log('Open WhatsApp > Linked Devices > Link with phone number instead');
        console.log('======================================================\n');
        waStatus = 'pairing_code_ready';
        latestQr = `PAIRING_CODE:${code}`;
      } else {
        console.error('❌ Failed to generate pairing code. Falling back to QR code.');
        waStatus = 'qr_ready';
        qrcode.generate(qr, { small: true });
      }
    } else if (!pairingNumber) {
      console.log('\n\n======================================================');
      console.log('📱 SCAN THIS QR CODE IN WHATSAPP TO LINK YOUR ACCOUNT 📱');
      console.log('======================================================\n');
      qrcode.generate(qr, { small: true });
    }
  });

  waClient.on('ready', () => {
    isWaConnected = true;
    waStatus = 'connected';
    latestQr = null;
    console.log('\n✅ WhatsApp Client is READY and linked!');
  });

  waClient.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated!');
  });

  waClient.on('auth_failure', msg => {
    console.error('❌ WhatsApp Authentication failure', msg);
  });

  waClient.on('disconnected', async (reason) => {
    console.log('❌ WhatsApp Client was disconnected', reason);
    isWaConnected = false;
    waStatus = 'disconnected';
    latestQr = null;

    // Destroy current client
    try {
      await waClient.destroy();
    } catch (e) {
      console.log('Error destroying client on disconnect:', e.message);
    }

    // Force clear the entire session directory to ensure a fresh QR code
    try {
      const authPath = path.join(process.cwd(), '.wwebjs_auth');
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
    } catch (e) {
      console.log('Error clearing auth directory:', e.message);
    }

    // Fast restart to show QR immediately
    setTimeout(() => {
      console.log('🔄 Re-initializing WhatsApp to get new QR code...');
      initializeWhatsApp();
    }, 2000);
  });

  waClient.initialize().catch(err => {
    console.error('❌ WhatsApp Initialization Error:', err);
    waStatus = 'disconnected';
  });
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

// ── Handle VPS / Server Restart Lockfile cleanup ─────────────────────────────
const shutdownWhatsApp = async () => {
  if (waClient) {
    console.log('Shutting down WhatsApp client...');
    try {
      await waClient.destroy();
      console.log('WhatsApp client shut down gracefully.');
    } catch (err) {
      console.log('Error shutting down WhatsApp client:', err.message);
    }
  }
  process.exit(0);
};

// Graceful exit to prevent lockfile issues on VPS
process.on('SIGINT', shutdownWhatsApp);
process.on('SIGTERM', shutdownWhatsApp);
process.on('SIGUSR2', shutdownWhatsApp); // For nodemon

