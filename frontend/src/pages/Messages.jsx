import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, CheckCircle, Car, User, MapPin,
  ChevronDown, Filter, Search, RefreshCw, X, Clock,
  Phone, Calendar, Ruler, Timer, IndianRupee
} from 'lucide-react';
import API_BASE_URL from '../config';

const TYPE_META = {
  booking_confirmed: {
    label: 'Booking Confirmed',
    color: '#10B981',
    bg: '#ECFDF5',
    border: '#6EE7B7',
    icon: <CheckCircle size={18} />,
  },
  trip_assigned: {
    label: 'Trip Assigned',
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#FCD34D',
    icon: <Car size={18} />,
  },
  trip_closed: {
    label: 'Trip Closed',
    color: '#6366F1',
    bg: '#EEF2FF',
    border: '#A5B4FC',
    icon: <CheckCircle size={18} />,
  },
};

const RECIPIENT_META = {
  customer: { label: 'Customer', color: '#3B82F6', bg: '#EFF6FF' },
  driver:   { label: 'Driver',   color: '#8B5CF6', bg: '#F5F3FF' },
};

const formatTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

// ── Message Bubble (WhatsApp style) ──────────────────────────────────────────
const MessageBubble = ({ msg }) => {
  const [open, setOpen] = useState(false);
  const meta = TYPE_META[msg.messageType] || TYPE_META.booking_confirmed;
  const rMeta = RECIPIENT_META[msg.recipient] || RECIPIENT_META.customer;
  const isCustomer = msg.recipient === 'customer';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isCustomer ? 'flex-start' : 'flex-end',
        marginBottom: '12px',
      }}
    >
      {/* Sender badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px',
        flexDirection: isCustomer ? 'row' : 'row-reverse' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: rMeta.bg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: rMeta.color, fontSize: '12px', fontWeight: '700'
        }}>
          {msg.recipient === 'customer' ? <User size={14} /> : <Car size={14} />}
        </div>
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#6F767E' }}>
          {msg.recipientName} · {msg.recipientPhone}
        </span>
        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{formatTime(msg.sentAt)}</span>
      </div>

      {/* Bubble */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          maxWidth: '520px',
          minWidth: '260px',
          background: isCustomer ? 'white' : '#DCFCE7',
          border: `1.5px solid ${meta.border}`,
          borderRadius: isCustomer ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
          padding: '14px 18px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
      >
        {/* Type badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: meta.bg, color: meta.color,
            fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '99px'
          }}>
            {meta.icon}
            {meta.label}
          </div>
          {msg.bookingId && (
            <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600' }}>
              {msg.bookingId}
            </span>
          )}
        </div>

        {/* Message text */}
        <pre style={{
          fontFamily: 'inherit', fontSize: '13.5px', color: '#1A1D1F',
          lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0
        }}>
          {msg.messageBody}
        </pre>

        {/* Expandable details */}
        <div style={{ marginTop: '10px', borderTop: '1px dashed #E5E7EB', paddingTop: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '500' }}>
            {open ? 'Hide details' : 'View details'}
          </span>
          <ChevronDown size={14} color="#9CA3AF"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {msg.pickup && (
                  <Detail icon={<MapPin size={12} />} label="Pickup" value={msg.pickup} />
                )}
                {msg.drop && (
                  <Detail icon={<MapPin size={12} color="#EF4444" />} label="Drop" value={msg.drop} />
                )}
                {msg.driverName && (
                  <Detail icon={<User size={12} />} label="Driver" value={`${msg.driverName} (${msg.driverPhone})`} />
                )}
                {msg.vehicleType && (
                  <Detail icon={<Car size={12} />} label="Vehicle" value={msg.vehicleType} />
                )}
                {msg.tripDate && (
                  <Detail icon={<Calendar size={12} />} label="Date/Time" value={msg.tripDate} />
                )}
                {msg.km > 0 && (
                  <Detail icon={<Ruler size={12} />} label="Distance" value={`${msg.km} KM`} />
                )}
                {msg.duration && (
                  <Detail icon={<Timer size={12} />} label="Duration" value={`${msg.duration} hrs`} />
                )}
                {msg.total > 0 && (
                  <Detail icon={<IndianRupee size={12} />} label="Total" value={`₹${msg.total}`} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status indicator */}
      <div style={{ 
        alignSelf: isCustomer ? 'flex-start' : 'flex-end',
        width: '100%', 
        display: 'flex', 
        justifyContent: isCustomer ? 'flex-start' : 'flex-end',
        marginTop: '3px'
      }}>
        {(() => {
          const status = msg.status || 'sent';
          const errorCode = msg.errorCode;

          if (status === 'delivered' || status === 'read') {
            return (
              <div style={{ fontSize: '11px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>✓✓ Delivered</span>
              </div>
            );
          }

          if (errorCode === 63015) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', maxWidth: '520px' }}>
                <div style={{ fontSize: '11.5px', color: '#EF4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>⚠️ Delivery Failed (Sandbox Opt-in Required)</span>
                </div>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.04)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#4B5563',
                  lineHeight: '1.5',
                  textAlign: 'left'
                }}>
                  <strong>How to fix:</strong> The recipient must opt-in to receive messages. Ask them to add your Twilio WhatsApp number to their contacts and send: <code>join &lt;sandbox-keyword&gt;</code> to it.
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '6px' }}>
                    Go to <strong>Settings</strong> to find your Sandbox number and instructions.
                  </div>
                </div>
              </div>
            );
          }

          if (status === 'failed' || status === 'undelivered') {
            return (
              <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: '500' }}>
                <span>❌ Failed {msg.errorMessage ? `(${msg.errorMessage})` : `(Error ${errorCode || 'Unknown'})`}</span>
              </div>
            );
          }

          if (status === 'queued' || status === 'accepted') {
            return (
              <div style={{ fontSize: '11px', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>⏳ Processing...</span>
              </div>
            );
          }

          return (
            <div style={{ fontSize: '11px', color: '#10B981' }}>
              <span>✓ Sent</span>
            </div>
          );
        })()}
      </div>
    </motion.div>
  );
};

const Detail = ({ icon, label, value }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: '5px',
    background: '#F8FAFC', borderRadius: '8px', padding: '6px 10px',
    minWidth: '140px', flex: '1 1 140px'
  }}>
    <span style={{ color: '#6B7280', marginTop: '1px', flexShrink: 0 }}>{icon}</span>
    <div>
      <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: '#1A1D1F', fontWeight: '600' }}>{value}</div>
    </div>
  </div>
);

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, bg }) => (
  <div style={{
    background: 'white', borderRadius: '16px', padding: '20px 24px',
    border: '1px solid #F1F3F5', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 160px'
  }}>
    <div style={{ width: '44px', height: '44px', borderRadius: '12px',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '24px', fontWeight: '800', color: '#1A1D1F', lineHeight: 1 }}>{value ?? '–'}</div>
      <div style={{ fontSize: '12px', color: '#6F767E', fontWeight: '500', marginTop: '4px' }}>{label}</div>
    </div>
  </div>
);

// ── Main Messages Page ────────────────────────────────────────────────────────
const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterRecipient, setFilterRecipient] = useState('all');

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const [msgRes, statRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/messages`),
        fetch(`${API_BASE_URL}/api/messages/stats`)
      ]);
      const [msgData, statData] = await Promise.all([msgRes.json(), statRes.json()]);
      setMessages(Array.isArray(msgData) ? msgData : []);
      setStats(statData);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const filtered = messages.filter(m => {
    if (filterType !== 'all' && m.messageType !== filterType) return false;
    if (filterRecipient !== 'all' && m.recipient !== filterRecipient) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        m.recipientName?.toLowerCase().includes(s) ||
        m.recipientPhone?.includes(s) ||
        m.bookingId?.toLowerCase().includes(s) ||
        m.pickup?.toLowerCase().includes(s) ||
        m.drop?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const FilterBtn = ({ value, current, set, label }) => (
    <button
      onClick={() => set(value)}
      style={{
        padding: '7px 14px', borderRadius: '99px', fontSize: '12px', fontWeight: '600',
        border: '1.5px solid', cursor: 'pointer', transition: 'all 0.2s',
        borderColor: current === value ? 'var(--primary)' : '#E5E7EB',
        background: current === value ? 'var(--primary)' : 'white',
        color: current === value ? 'white' : '#6F767E',
      }}
    >{label}</button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div>
          <h1 className="section-title" style={{ marginBottom: '4px' }}>
            <MessageSquare size={24} style={{ display: 'inline', marginRight: '10px', verticalAlign: 'middle', color: 'var(--primary)' }} />
            Message Inbox
          </h1>
          <p className="section-subtitle">All notifications sent to customers and drivers · No payment required</p>
        </div>
        <button
          onClick={fetchMessages}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '12px', border: '1.5px solid #E5E7EB',
            background: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
            color: '#1A1D1F', transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#1A1D1F'; }}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <StatCard label="Total Messages" value={stats.total} icon={<MessageSquare size={20} />} color="#6366F1" bg="#EEF2FF" />
          <StatCard label="Booking Confirmed" value={stats.confirmed} icon={<CheckCircle size={20} />} color="#10B981" bg="#ECFDF5" />
          <StatCard label="Trip Assigned" value={stats.assigned} icon={<Car size={20} />} color="#F59E0B" bg="#FFFBEB" />
          <StatCard label="Trip Closed" value={stats.closed} icon={<CheckCircle size={20} />} color="#8B5CF6" bg="#F5F3FF" />
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: 'white', borderRadius: '16px', padding: '16px 20px',
        border: '1px solid #F1F3F5', marginBottom: '20px',
        display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, booking ID, location…"
            style={{
              width: '100%', padding: '9px 12px 9px 34px', borderRadius: '10px',
              border: '1.5px solid #E5E7EB', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box', transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = '#E5E7EB'}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '10px', top: '50%',
              transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Type filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={13} color="#9CA3AF" />
          <FilterBtn value="all" current={filterType} set={setFilterType} label="All Types" />
          <FilterBtn value="booking_confirmed" current={filterType} set={setFilterType} label="Booking" />
          <FilterBtn value="trip_assigned" current={filterType} set={setFilterType} label="Assigned" />
          <FilterBtn value="trip_closed" current={filterType} set={setFilterType} label="Closed" />
        </div>

        {/* Recipient filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <User size={13} color="#9CA3AF" />
          <FilterBtn value="all" current={filterRecipient} set={setFilterRecipient} label="All" />
          <FilterBtn value="customer" current={filterRecipient} set={setFilterRecipient} label="Customers" />
          <FilterBtn value="driver" current={filterRecipient} set={setFilterRecipient} label="Drivers" />
        </div>

        <span style={{ fontSize: '12px', color: '#9CA3AF', marginLeft: 'auto' }}>
          {filtered.length} message{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Chat window */}
      <div style={{
        backgroundColor: '#F0F4F8',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        borderRadius: '20px', border: '1px solid #E5E7EB',
        padding: '24px', minHeight: '400px',
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '10px', color: '#6F767E' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <RefreshCw size={20} />
            </motion.div>
            Loading messages…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9CA3AF' }}>
            <MessageSquare size={48} style={{ opacity: 0.15, marginBottom: '16px' }} />
            <h4 style={{ fontSize: '18px', fontWeight: '700', color: '#1A1D1F', marginBottom: '8px' }}>No Messages Yet</h4>
            <p style={{ fontSize: '14px' }}>
              Messages will appear here when you confirm a booking or assign/close a trip.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map(msg => (
              <MessageBubble key={msg._id} msg={msg} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default Messages;
