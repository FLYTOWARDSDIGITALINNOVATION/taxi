import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, ShieldCheck, MessageSquare, Key, RefreshCw } from 'lucide-react';
import API_BASE_URL from '../config';

const Settings = () => {
  const [waStatus, setWaStatus] = useState('initializing');
  const [twilioDetails, setTwilioDetails] = useState({ twilioNumber: '', accountSid: '', error: '' });
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/whatsapp/status`);
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        const data = await response.json();
        setWaStatus(data.status);
        setTwilioDetails({
          twilioNumber: data.twilioNumber || '',
          accountSid: data.accountSid || '',
          error: data.error || ''
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching WhatsApp status:', err);
        setError('Unable to connect to backend server');
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 5000); // Poll every 5s

    return () => clearInterval(intervalId);
  }, []);

  const handleRestart = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/restart`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        // Fetch status immediately to update UI
        const statusRes = await fetch(`${API_BASE_URL}/api/whatsapp/status`);
        const statusData = await statusRes.json();
        setWaStatus(statusData.status);
        setTwilioDetails({
          twilioNumber: statusData.twilioNumber || '',
          accountSid: statusData.accountSid || '',
          error: statusData.error || ''
        });
      }
    } catch (err) {
      console.error('Failed to restart WhatsApp service:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-container"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your application preferences and integrations</p>
        </div>
      </div>

      <div className="content-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(29, 161, 242, 0.1)', color: '#1da1f2' }}>
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>WhatsApp Twilio Integration</h2>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Official Twilio WhatsApp Business API</p>
              </div>
            </div>
            <button 
              onClick={handleRestart} 
              disabled={isRefreshing}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '14px' }}
            >
              {isRefreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
              Verify Credentials
            </button>
          </div>
          
          <div className="card-body" style={{ padding: '30px' }}>
            {error ? (
              <div style={{ color: 'var(--danger)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', padding: '40px 0' }}>
                <AlertCircle size={48} />
                <h3 style={{ fontSize: '20px' }}>Connection Error</h3>
                <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
              </div>
            ) : waStatus === 'initializing' ? (
              <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', padding: '40px 0' }}>
                <Loader2 size={48} className="spin" style={{ color: 'var(--primary)' }} />
                <h3>Initializing Twilio Service...</h3>
                <p>Checking environment variables and initializing Twilio client.</p>
              </div>
            ) : waStatus === 'twilio_ready' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                {/* Status Callout Banner */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px', 
                  background: 'rgba(16, 185, 129, 0.08)', 
                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                  padding: '20px', 
                  borderRadius: '12px' 
                }}>
                  <div style={{ padding: '10px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--success)', fontWeight: '600' }}>Service Operational</h4>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Twilio WhatsApp Client is online and successfully configured. Messages will send automatically.
                    </p>
                  </div>
                </div>

                {/* Configuration Details Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                  gap: '20px',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '24px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Twilio Account SID</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      <Key size={16} style={{ color: 'var(--primary)' }} />
                      <code>{twilioDetails.accountSid || 'Not Configured'}</code>
                    </div>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Sender WhatsApp ID</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
                      <code>{twilioDetails.twilioNumber || 'Not Configured'}</code>
                    </div>
                  </div>
                </div>

                {/* Instructions Box */}
                <div style={{ 
                  background: 'rgba(59, 130, 246, 0.05)', 
                  border: '1px solid rgba(59, 130, 246, 0.15)', 
                  padding: '24px', 
                  borderRadius: '12px' 
                }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--text-primary)', fontWeight: '600' }}>
                    📲 Twilio Sandbox Opt-in Instructions
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                    If you are using the Twilio WhatsApp Sandbox, your drivers and clients must opt-in to your Sandbox number before receiving notifications. Follow these instructions:
                  </p>
                  <ol style={{ textAlign: 'left', color: 'var(--text-secondary)', lineHeight: '1.7', paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '8px' }}>
                      Ask your user (Client or Driver) to add the Sender Number <strong>{twilioDetails.twilioNumber || 'your Twilio number'}</strong> to their phone contacts.
                    </li>
                    <li>
                      Instruct them to send the required Sandbox join command (e.g. <strong>join &lt;your-sandbox-keyword&gt;</strong>) as a message to that number in WhatsApp.
                    </li>
                  </ol>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px', 
                  background: 'rgba(245, 158, 11, 0.08)', 
                  border: '1px solid rgba(245, 158, 11, 0.2)', 
                  padding: '20px', 
                  borderRadius: '12px' 
                }}>
                  <div style={{ padding: '10px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                    <AlertCircle size={28} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--warning)', fontWeight: '600' }}>Service Disconnected</h4>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Twilio client is not initialized. Please verify your credentials in the backend environment config.
                    </p>
                  </div>
                </div>
                {twilioDetails.error && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '16px', borderRadius: '8px', color: 'var(--danger)', fontSize: '14px' }}>
                    <strong>Error:</strong> {twilioDetails.error}
                  </div>
                )}
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  <p style={{ margin: '0 0 12px 0' }}>Please ensure the following environment variables are correctly populated in your backend `.env` file:</p>
                  <code style={{ display: 'block', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                    TWILIO_ACCOUNT_SID=your_account_sid_here<br />
                    TWILIO_AUTH_TOKEN=your_auth_token_here<br />
                    TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
                  </code>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .spin {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </motion.div>
  );
};

export default Settings;
