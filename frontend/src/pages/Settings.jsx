import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import API_BASE_URL from '../config';

const Settings = () => {
  const [waStatus, setWaStatus] = useState('initializing');
  const [qrCode, setQrCode] = useState(null);
  const [error, setError] = useState(null);

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
        setQrCode(data.qr);
        setError(null);
      } catch (err) {
        console.error('Error fetching WhatsApp status:', err);
        setError('Unable to connect to server');
      }
    };

    // Fetch immediately
    fetchStatus();

    // Poll every 3 seconds
    intervalId = setInterval(fetchStatus, 3000);

    return () => clearInterval(intervalId);
  }, []);

  const handleRestart = async () => {
    try {
      setWaStatus('initializing');
      await fetch(`${API_BASE_URL}/api/whatsapp/restart`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to restart WhatsApp', err);
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
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>WhatsApp Integration</h2>
            <button 
              onClick={handleRestart} 
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Regenerate Code
            </button>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', textAlign: 'center' }}>
            
            {error ? (
              <div style={{ color: 'var(--danger)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <AlertCircle size={48} />
                <h3>Connection Error</h3>
                <p>{error}</p>
              </div>
            ) : waStatus === 'initializing' ? (
              <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <Loader2 size={48} className="spin" />
                <h3>Initializing WhatsApp Client</h3>
                <p>Please wait while we connect to the WhatsApp network...</p>
              </div>
            ) : waStatus === 'pairing_code_ready' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <h1 style={{ fontSize: '48px', letterSpacing: '4px', margin: 0, color: 'var(--primary)' }}>
                    {qrCode ? qrCode.replace('PAIRING_CODE:', '') : '...'}
                  </h1>
                </div>
                <div style={{ maxWidth: '400px' }}>
                  <h3 style={{ marginBottom: '8px', fontSize: '20px', color: 'var(--text-primary)' }}>Link Your Account (Phone Number)</h3>
                  <ol style={{ textAlign: 'left', color: 'var(--text-secondary)', lineHeight: '1.6', paddingLeft: '20px' }}>
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap <strong>Menu</strong> or <strong>Settings</strong> and select <strong>Linked Devices</strong></li>
                    <li>Tap on <strong>Link a Device</strong></li>
                    <li>Tap <strong>Link with phone number instead</strong> at the bottom</li>
                    <li>Enter the 8-character code shown above</li>
                  </ol>
                </div>
              </div>
            ) : waStatus === 'qr_ready' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {qrCode ? (
                    <QRCodeSVG value={qrCode} size={250} level="H" />
                  ) : (
                    <Loader2 size={48} className="spin" style={{ color: 'var(--primary)' }} />
                  )}
                </div>
                <div style={{ maxWidth: '400px' }}>
                  <h3 style={{ marginBottom: '8px', fontSize: '20px', color: 'var(--text-primary)' }}>Link Your Account</h3>
                  <ol style={{ textAlign: 'left', color: 'var(--text-secondary)', lineHeight: '1.6', paddingLeft: '20px' }}>
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap <strong>Menu</strong> or <strong>Settings</strong> and select <strong>Linked Devices</strong></li>
                    <li>Tap on <strong>Link a Device</strong></li>
                    <li>Point your phone to this screen to capture the QR code</li>
                  </ol>
                </div>
              </div>
            ) : waStatus === 'connected' ? (
              <div style={{ color: 'var(--success)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={40} />
                </div>
                <h3>WhatsApp Connected</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Your WhatsApp account is successfully linked and ready to send notifications.</p>
              </div>
            ) : waStatus === 'disconnected' ? (
              <div style={{ color: 'var(--warning)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle size={40} />
                </div>
                <h3>WhatsApp Disconnected</h3>
                <p style={{ color: 'var(--text-secondary)' }}>The client was disconnected. Please wait for the service to restart and provide a new QR code.</p>
              </div>
            ) : null}

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
