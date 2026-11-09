import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './assets/index.css'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1E1B4B',
          color: '#fff',
          fontSize: '14px',
        },
        success: {
          style: { background: '#059669', color: '#fff' },
          iconTheme: { primary: '#fff', secondary: '#059669' },
        },
        error: {
          style: { background: '#DC2626', color: '#fff' },
          iconTheme: { primary: '#fff', secondary: '#DC2626' },
        },
      }}
    />
  </React.StrictMode>,
)
