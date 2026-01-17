import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
    Home,
    Users,
    ShoppingCart,
    UserCheck,
    CreditCard,
    Receipt,
    PieChart,
    Settings,
    Truck,
    Menu,
    X,
    FileText,
    ClipboardList,
    LogOut
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useSeason } from '../../context/SeasonContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../services/supabase'
import './Layout.css'

const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/sales', icon: CreditCard, label: 'Sales' },
    { path: '/purchases', icon: ShoppingCart, label: 'Purchases' },
    { path: '/all-sales', icon: FileText, label: 'All Sales' },
    { path: '/customers', icon: UserCheck, label: 'Customers' },
    { path: '/enquiries', icon: ClipboardList, label: 'Enquiries' },
    { path: '/farmers', icon: Users, label: 'Farmers' },
    { path: '/payments', icon: Receipt, label: 'Payments' },
    { path: '/expenses', icon: Truck, label: 'Expenses' },
    { path: '/reports', icon: PieChart, label: 'Reports' },
    { path: '/settings', icon: Settings, label: 'Settings' },
]

function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [businessName, setBusinessName] = useState('Dixit Mangoes')
    const { currentSeason } = useSeason()
    const { logout } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

    useEffect(() => {
        fetchBusinessName()
    }, [])

    const fetchBusinessName = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'business_name')
                .maybeSingle()

            if (data?.value) {
                setBusinessName(data.value)
            }
        } catch (error) {
            console.error('Error fetching business name:', error)
        }
    }

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="header-left">
                    <button className="btn btn-ghost btn-icon md:hidden" onClick={toggleSidebar}>
                        <Menu size={24} />
                    </button>
                    <div className="header-brand">
                        <img src="/mango.svg" alt="Logo" className="brand-icon" />
                        <span className="brand-name">{businessName}</span>
                    </div>
                </div>
                <div className="header-right">
                    {currentSeason ? (
                        <span className="season-badge">
                            {currentSeason.name || 'Active Season'}
                        </span>
                    ) : (
                        <span className="season-badge season-badge-inactive">
                            No Active Season
                        </span>
                    )}
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={handleLogout}
                        title="Logout"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            {/* Desktop Sidebar */}
            <aside className="sidebar desktop-only">
                <nav className="sidebar-nav">
                    {navItems.map(({ path, icon: Icon, label }) => (
                        <NavLink
                            key={path}
                            to={path}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={20} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                    <button onClick={handleLogout} className="sidebar-link w-full text-left">
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </nav>
            </aside>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="sidebar-overlay mobile-only" onClick={toggleSidebar}>
                    <aside className="sidebar-mobile" onClick={(e) => e.stopPropagation()}>
                        <div className="sidebar-mobile-header">
                            <img src="/mango.svg" alt="Logo" className="brand-icon" />
                            <span className="brand-name">{businessName}</span>
                            <button className="btn btn-ghost btn-icon" onClick={toggleSidebar}>
                                <X size={24} />
                            </button>
                        </div>
                        <nav className="sidebar-nav">
                            {navItems.map(({ path, icon: Icon, label }) => (
                                <NavLink
                                    key={path}
                                    to={path}
                                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                    onClick={toggleSidebar}
                                >
                                    <Icon size={20} />
                                    <span>{label}</span>
                                </NavLink>
                            ))}
                            <button onClick={handleLogout} className="sidebar-link w-full text-left">
                                <LogOut size={20} />
                                <span>Logout</span>
                            </button>
                        </nav>
                    </aside>
                </div>
            )}

            {/* Main Content */}
            <main className="main-content">
                {children}
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="bottom-nav mobile-only">
                {navItems.slice(0, 5).map(({ path, icon: Icon, label }) => (
                    <NavLink
                        key={path}
                        to={path}
                        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <Icon size={20} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    )
}

export default Layout
