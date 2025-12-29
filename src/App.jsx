import { Routes, Route, Navigate } from 'react-router-dom'
import { useSeason } from './context/SeasonContext'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Farmers from './pages/Farmers'
import Purchases from './pages/Purchases'
import Customers from './pages/Customers'
import Sales from './pages/Sales'
import Payments from './pages/Payments'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Receipts from './pages/Receipts'

function App() {
    const { loading } = useSeason()

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/farmers" element={<Farmers />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/receipts" element={<Receipts />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    )
}

export default App
