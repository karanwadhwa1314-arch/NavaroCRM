'use client';

import { Toaster as HotToaster } from 'react-hot-toast';

const baseStyle = {
  background: '#FFFFFF',
  color: '#054742',
  border: '1px solid #E1E5DE',
  borderRadius: '10px',
  boxShadow: 'none',
  padding: '12px 16px',
  fontSize: '14px',
};

export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: { ...baseStyle, borderLeft: '4px solid #C780ED' },
        success: { style: { ...baseStyle, borderLeft: '4px solid #3ECEB9' } },
        error: { style: { ...baseStyle, borderLeft: '4px solid #B42318' } },
      }}
    />
  );
}
