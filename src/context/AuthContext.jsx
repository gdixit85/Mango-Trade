import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check local storage for session
        const session = localStorage.getItem('mango_auth_session')
        if (session) {
            setIsAuthenticated(true)
        }
        setLoading(false)
    }, [])

    const login = async (pin) => {
        try {
            // First check if admin_pin is set in settings
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'admin_pin')
                .maybeSingle()

            if (error) throw error

            const storedPin = data?.value || '1234' // Default PIN

            if (pin === storedPin) {
                setIsAuthenticated(true)
                localStorage.setItem('mango_auth_session', 'true')
                return true
            }
            return false
        } catch (error) {
            console.error('Login error:', error)
            // Fallback to default if DB fails (safety net for initial setup)
            if (pin === '1234') {
                setIsAuthenticated(true)
                localStorage.setItem('mango_auth_session', 'true')
                return true
            }
            return false
        }
    }

    const logout = () => {
        setIsAuthenticated(false)
        localStorage.removeItem('mango_auth_session')
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
