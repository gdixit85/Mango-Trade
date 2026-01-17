import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { SeasonProvider } from './context/SeasonContext.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { ToastProvider } from './components/common/Toast.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ToastProvider>
                <SeasonProvider>
                    <AppProvider>
                        <App />
                    </AppProvider>
                </SeasonProvider>
            </ToastProvider>
        </BrowserRouter>
    </React.StrictMode>,
)
