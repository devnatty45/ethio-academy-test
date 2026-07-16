'use client';

import { useState } from 'react';

export default function TransferTestPage() {
  const [loading, setLoading] = useState<boolean>(false);
  const [responseMessage, setResponseMessage] = useState<string>('');

  const handleTestTransfer = async () => {
    setLoading(true);
    setResponseMessage('');
    
    try {
      const res = await fetch('/api/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountNumber: '1000123456789', // Mock CBE Account Number
    accountName: 'Abebe Kebede',    // Clean English test name (No slashes or symbols)
    amount: '100',
    bankCode: '656',                // Numeric bank code (CBE)
  }),
});

      const result = await res.json();
      
      if (result.success) {
        setResponseMessage(`Success! Transaction simulated. Chapa ID: ${result.data.data.reference}`);
      } else {
        // FIXED: Stringify the response so you don't get [object Object]
        setResponseMessage(`Transfer Failed: ${JSON.stringify(result.error || result)}`);
      }
    } catch (err: any) {
      console.error(err);
      setResponseMessage(`An unexpected network error occurred: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Chapa Transfer API Tester (TS)</h1>
      <p>Click below to simulate sending 100 ETB from your test balance.</p>
      
      <button 
        onClick={handleTestTransfer} 
        disabled={loading}
        style={{
          padding: '12px 24px',
          backgroundColor: '#00c389',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          fontSize: '16px',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Processing...' : 'Send 100 ETB (Test)'}
      </button>

      {responseMessage && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '5px', color: '#333', wordBreak: 'break-word' }}>
          <strong>Status:</strong> {responseMessage}
        </div>
      )}
    </div>
  );
}
