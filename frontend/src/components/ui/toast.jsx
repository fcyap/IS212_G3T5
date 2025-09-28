"use client"

import { Toaster } from "react-hot-toast"

export function Toast() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1f1f23',
          color: '#fff',
          border: '1px solid #374151',
        },
        success: {
          style: {
            background: '#065f46',
            border: '1px solid #10b981',
          },
        },
        error: {
          style: {
            background: '#7f1d1d',
            border: '1px solid #ef4444',
          },
        },
      }}
    />
  )
}
