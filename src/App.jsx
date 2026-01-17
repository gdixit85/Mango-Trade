import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSeason } from './context/SeasonContext'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/layout/Layout'
import OfflineIndicator from './components/common/OfflineIndicator'
import ProtectedRoute from './components/common/ProtectedRoute'

// Lazy load pages - only Dashboard loads immediately
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Farmers = lazy(() => import('./pages/Farmers'))
const Purchases = lazy(() => import('./pages/Purchases'))
const Customers = lazy(() => import('./pages/Customers'))
const Sales = lazy(() => import('./pages/Sales'))
const AllSales = lazy(() => import('./pages/AllSales'))
const Payments = lazy(() => import('./pages/Payments'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Receipts = lazy(() => import('./pages/Receipts'))
const Enquiries = lazy(() => import('./pages/Enquiries'))

// Loading fallback component
const PageLoader = () => (
    <div className="loading-container" style={{ minHeight: '50vh' }}>
        <div className="spinner"></div>
    </div>
)

function AppContent() {
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
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/farmers" element={<Farmers />} />
                    <Route path="/purchases" element={<Purchases />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/enquiries" element={<Enquiries />} />
                    <Route path="/sales" element={<Sales />} />
                    <Route path="/all-sales" element={<AllSales />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/receipts" element={<Receipts />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </Layout>
    )
}

function App() {
    return (
        <AuthProvider>
            <OfflineIndicator />
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                        path="/*"
                        element={
                            <ProtectedRoute>
                                <AppContent />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </Suspense>
        </AuthProvider>
    )
}

export default App
