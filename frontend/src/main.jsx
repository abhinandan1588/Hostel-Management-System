import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import App from './App.jsx'
import { AuthProvider } from './context/AuthProvider.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ToastContainer
          position="top-right"
          autoClose={4000}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss={false}
          theme="light"
          aria-label="Notifications"
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
