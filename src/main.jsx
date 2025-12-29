import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { SeasonProvider } from './context/SeasonContext.jsx'
import { ToastProvider } from './components/common/Toast.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <ToastProvider>
                <SeasonProvider>
                    <App />
                </SeasonProvider>
            </ToastProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
