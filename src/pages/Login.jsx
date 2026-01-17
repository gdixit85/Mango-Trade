import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Login.css'

function Login() {
    const [pin, setPin] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const from = location.state?.from?.pathname || '/'

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (pin.length < 4) {
            setError('PIN must be at least 4 digits')
            return
        }

        setLoading(true)
        setError('')

        const success = await login(pin)

        if (success) {
            navigate(from, { replace: true })
        } else {
            setError('Invalid PIN. Default is 1234')
            setLoading(false)
            setPin('')
        }
    }

    const handlePinChange = (e) => {
        const value = e.target.value
        // Only allow numbers
        if (/^\d*$/.test(value)) {
            setPin(value)
            setError('')
        }
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="brand-logo">
                        <img src="/mango.svg" alt="Dixit Mangoes" />
                    </div>
                    <h1>Dixit Mangoes</h1>
                    <p className="login-subtitle">Enter PIN to access the system</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="pin-input-group">
                        <Lock className="input-icon" size={20} />
                        <input
                            type="password"
                            value={pin}
                            onChange={handlePinChange}
                            placeholder="Enter PIN"
                            className="pin-input"
                            maxLength={8}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading || !pin}
                    >
                        {loading ? 'Verifying...' : 'Login'}
                        {!loading && <ArrowRight size={20} />}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Login
