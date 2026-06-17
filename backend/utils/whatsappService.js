import twilio from 'twilio';
import { Message } from '../models/Message.js';

let accountSid = null;
let authToken = null;
let twilioFrom = 'whatsapp:+14155238886';
let twilioClient = null;

export const initializeWhatsApp = () => {
  accountSid = process.env.TWILIO_ACCOUNT_SID;
  authToken = process.env.TWILIO_AUTH_TOKEN;
  twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  console.log('🤖 Initializing Twilio WhatsApp Service...');
  if (!accountSid || !authToken) {
    console.error('❌ Twilio configuration missing! Please check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your .env file.');
    twilioClient = null;
  } else {
    try {
      twilioClient = twilio(accountSid, authToken);
      console.log('✅ Twilio WhatsApp Service configured successfully!');
      console.log(`📤 Sender: ${twilioFrom}`);
    } catch (error) {
      console.error('❌ Error initializing Twilio client:', error.message);
      twilioClient = null;
    }
  }
};

export const getWhatsAppStatus = () => {
  if (!twilioClient) {
    return {
      status: 'disconnected',
      provider: 'twilio',
      twilioNumber: twilioFrom,
      error: 'Twilio client not initialized. Check credentials.'
    };
  }
  return {
    status: 'twilio_ready',
    provider: 'twilio',
    twilioNumber: twilioFrom,
    accountSid: accountSid ? `${accountSid.substring(0, 6)}...${accountSid.substring(accountSid.length - 6)}` : null
  };
};

export const restartWhatsApp = async () => {
  console.log('🔄 Re-verifying Twilio configuration...');
  initializeWhatsApp();
  return { success: true, message: 'Twilio WhatsApp integration status updated.' };
};

const formatTwilioPhone = (phone) => {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  return `whatsapp:+${clean}`;
};

// ── Booking Confirmed (sent to customer) ──────────────────────────────────────
export const sendBookingConfirmedMessage = async ({ bookingId, customerName, customerPhone, pickup, drop, date, vehicleType }) => {
  const body = `Hi ${customerName}, your Nanban Taxi booking is confirmed.\nPickup: ${pickup}\nDrop: ${drop}\nDate/Time: ${date}\nVehicle Type: ${vehicleType}\nThank you for choosing Nanban Taxi +91 9600989735.`;

  const msg = await Message.create({
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
  const twilioRes = await _tryWhatsApp(formatTwilioPhone(customerPhone), body);
  if (twilioRes) {
    msg.twilioSid = twilioRes.twilioSid;
    msg.status = twilioRes.status;
    msg.errorCode = twilioRes.errorCode;
    msg.errorMessage = twilioRes.errorMessage;
    await msg.save();
  }
  return true;
};

// ── Trip Assigned (sent to customer & driver) ─────────────────────────────────
export const sendCustomerNotification = async (booking, taxi, driver) => {
  const dateStr = new Date(booking.date).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const body = `Hello ${booking.customer}, your trip from ${booking.pickup} to ${booking.drop} has been assigned.\nDriver: ${driver.name} (${driver.phone}).\n- Nanban Taxi`;

  const msg = await Message.create({
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
  const twilioRes = await _tryWhatsApp(formatTwilioPhone(booking.phone), body);
  if (twilioRes) {
    msg.twilioSid = twilioRes.twilioSid;
    msg.status = twilioRes.status;
    msg.errorCode = twilioRes.errorCode;
    msg.errorMessage = twilioRes.errorMessage;
    await msg.save();
  }
  return true;
};

export const sendDriverNotification = async (booking, taxi, driver) => {
  const dateStr = new Date(booking.date).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const body = `Trip Assigned:\nCustomer: ${booking.customer} (${booking.phone})\nPickup: ${booking.pickup}\nDrop: ${booking.drop}\nTime: ${dateStr}`;

  const msg = await Message.create({
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
  const twilioRes = await _tryWhatsApp(formatTwilioPhone(driver.phone), body);
  if (twilioRes) {
    msg.twilioSid = twilioRes.twilioSid;
    msg.status = twilioRes.status;
    msg.errorCode = twilioRes.errorCode;
    msg.errorMessage = twilioRes.errorMessage;
    await msg.save();
  }
  return true;
};

// ── Trip Closed (sent to customer) ────────────────────────────────────────────
export const sendTripClosedMessage = async ({ bookingId, customerName, customerPhone, pickup, drop, km, duration, total }) => {
  const body = `Hi ${customerName}, your trip with Nanban Taxi is closed.\nKM: ${km}\nDuration: ${duration} hrs\nTotal: ₹${total}`;

  const msg = await Message.create({
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
  const twilioRes = await _tryWhatsApp(formatTwilioPhone(customerPhone), body);
  if (twilioRes) {
    msg.twilioSid = twilioRes.twilioSid;
    msg.status = twilioRes.status;
    msg.errorCode = twilioRes.errorCode;
    msg.errorMessage = twilioRes.errorMessage;
    await msg.save();
  }
  return true;
};

// ── Internal: send real WhatsApp message ──────────────────────────────────────
async function _tryWhatsApp(to, body) {
  if (!twilioClient) {
    console.log(`[Twilio Warning] Message not sent. Twilio is not initialized.`);
    return null;
  }
  if (!to) return null;

  try {
    const res = await twilioClient.messages.create({
      from: twilioFrom,
      to: to,
      body: body
    });
    console.log(`✅ Real WhatsApp Message sent via Twilio to ${to}. SID: ${res.sid}`);
    return {
      twilioSid: res.sid,
      status: res.status,
      errorCode: res.errorCode,
      errorMessage: res.errorMessage
    };
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp message via Twilio to ${to}:`, err.message);
    return {
      status: 'failed',
      errorCode: err.code || 500,
      errorMessage: err.message
    };
  }
}

// ── Sync Message Statuses from Twilio ──────────────────────────────────────────
export const updateMessageStatuses = async () => {
  if (!twilioClient) return;

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingMsgs = await Message.find({
      sentAt: { $gte: cutoff },
      twilioSid: { $exists: true, $ne: null },
      status: { $in: ['pending', 'queued', 'sent', 'accepted'] }
    }).limit(20);

    if (pendingMsgs.length === 0) return;

    console.log(`🔄 Syncing status for ${pendingMsgs.length} pending Twilio messages...`);
    
    for (const msg of pendingMsgs) {
      try {
        const twilioMsg = await twilioClient.messages(msg.twilioSid).fetch();
        
        let changed = false;
        if (msg.status !== twilioMsg.status) {
          msg.status = twilioMsg.status;
          changed = true;
        }
        if (msg.errorCode !== twilioMsg.errorCode) {
          msg.errorCode = twilioMsg.errorCode;
          changed = true;
        }
        if (msg.errorMessage !== twilioMsg.errorMessage) {
          msg.errorMessage = twilioMsg.errorMessage;
          changed = true;
        }
        
        if (changed) {
          await msg.save();
          console.log(`  Updated message ${msg.twilioSid}: status=${msg.status}, errorCode=${msg.errorCode || 'None'}`);
        }
      } catch (err) {
        console.error(`  Error fetching Twilio status for ${msg.twilioSid}:`, err.message);
        if (err.status === 404) {
          msg.status = 'failed';
          msg.errorMessage = 'Message not found on Twilio';
          await msg.save();
        }
      }
    }
  } catch (error) {
    console.error('❌ Error during updateMessageStatuses:', error.message);
  }
};
