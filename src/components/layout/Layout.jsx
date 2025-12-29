import { NavLink, useLocation } from 'react-router-dom'
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
    X
} from 'lucide-react'
import { useState } from 'react'
import { useSeason } from '../../context/SeasonContext'
import './Layout.css'

const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/farmers', icon: Users, label: 'Farmers' },
    { path: '/purchases', icon: ShoppingCart, label: 'Purchases' },
    { path: '/customers', icon: UserCheck, label: 'Customers' },
    { path: '/sales', icon: CreditCard, label: 'Sales' },
    { path: '/payments', icon: Receipt, label: 'Payments' },
    { path: '/expenses', icon: Truck, label: 'Expenses' },
    { path: '/reports', icon: PieChart, label: 'Reports' },
    { path: '/settings', icon: Settings, label: 'Settings' },
]

function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { currentSeason } = useSeason()
    const location = useLocation()

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="header-left">
                    <button className="btn btn-ghost btn-icon md:hidden" onClick={toggleSidebar}>
                        <Menu size={24} />
                    </button>
                    <div className="header-brand">
                        <span className="brand-icon">🥭</span>
                        <span className="brand-name">Mango Trade</span>
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
                </nav>
            </aside>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="sidebar-overlay mobile-only" onClick={toggleSidebar}>
                    <aside className="sidebar-mobile" onClick={(e) => e.stopPropagation()}>
                        <div className="sidebar-mobile-header">
                            <span className="brand-icon">🥭</span>
                            <span className="brand-name">Mango Trade</span>
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
