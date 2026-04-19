import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '14px',
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(21,101,192,0.15)',
          },
          success: { iconTheme: { primary: '#43A047', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#E53935', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
