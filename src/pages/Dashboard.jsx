import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    TrendingUp,
    TrendingDown,
    Users,
    ShoppingCart,
    CreditCard,
    Wallet,
    AlertCircle,
    ArrowRight,
    Calendar,
    ClipboardList,
    Package
} from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { formatCurrency, formatDate } from '../utils/helpers'
import './Dashboard.css'

function Dashboard() {
    const { currentSeason } = useSeason()
    const navigate = useNavigate()
    const [stats, setStats] = useState({
        totalPurchases: 0,
        totalSales: 0,
        farmerDues: 0,
        customerOutstanding: 0,
        todaySales: 0,
        totalExpenses: 0
    })
    const [recentActivity, setRecentActivity] = useState([])
    const [upcomingEnquiries, setUpcomingEnquiries] = useState([])
    const [stockSummary, setStockSummary] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (currentSeason) {
            fetchDashboardData()
        } else {
            setLoading(false)
        }
    }, [currentSeason])

    const fetchDashboardData = async () => {
        try {
            setLoading(true)

            // Fetch purchases total
            const { data: purchases } = await supabase
                .from('purchases')
                .select('total_amount')
                .eq('season_id', currentSeason.id)

            const totalPurchases = purchases?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0

            // Fetch sales total
            const { data: sales } = await supabase
                .from('sales')
                .select('total_amount, sale_date')
                .eq('season_id', currentSeason.id)

            const totalSales = sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0

            // Today's sales
            const today = new Date().toISOString().split('T')[0]
            const todaySales = sales?.filter(s => s.sale_date === today)
                .reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0

            // Fetch farmer dues
            const { data: farmers } = await supabase
                .from('farmers')
                .select('total_credit, total_paid')

            const farmerDues = farmers?.reduce((sum, f) =>
                sum + ((f.total_credit || 0) - (f.total_paid || 0)), 0) || 0

            // Fetch customer outstanding
            const { data: customers } = await supabase
                .from('customers')
                .select('total_outstanding, total_paid')
                .eq('type', 'credit')

            const customerOutstanding = customers?.reduce((sum, c) =>
                sum + ((c.total_outstanding || 0) - (c.total_paid || 0)), 0) || 0

            // Fetch expenses
            const { data: expenses } = await supabase
                .from('expenses')
                .select('amount')
                .eq('season_id', currentSeason.id)

            const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

            // Include rent in expenses
            const rentPaid = currentSeason.rent_paid || 0

            setStats({
                totalPurchases,
                totalSales,
                farmerDues,
                customerOutstanding,
                todaySales,
                totalExpenses: totalExpenses + rentPaid
            })

            // Fetch recent sales
            const { data: recentSales } = await supabase
                .from('sales')
                .select(`
          id,
          sale_date,
          total_amount,
          invoice_number,
          customers (name)
        `)
                .eq('season_id', currentSeason.id)
                .order('created_at', { ascending: false })
                .limit(5)

            setRecentActivity(recentSales || [])

            // Fetch upcoming enquiries (pending/confirmed, sorted by required_date)
            const { data: enquiriesData } = await supabase
                .from('enquiries')
                .select(`
                    id,
                    required_date,
                    quantity,
                    customer_id,
                    customer_name,
                    customers (name, phone),
                    package_sizes (name)
                `)
                .in('status', ['pending', 'confirmed'])
                .gte('required_date', new Date().toISOString().split('T')[0])
                .order('required_date', { ascending: true })
                .limit(5)

            setUpcomingEnquiries(enquiriesData || [])

            // Fetch stock summary (purchases vs sales per package size)
            const { data: packageSizes } = await supabase
                .from('package_sizes')
                .select('id, name, pieces_per_box')
                .eq('is_active', true)
                .order('pieces_per_box')

            const { data: purchaseItems } = await supabase
                .from('purchase_items')
                .select('package_size_id, quantity, purchases!inner(season_id)')
                .eq('purchases.season_id', currentSeason.id)

            const { data: saleItems } = await supabase
                .from('sale_items')
                .select('package_size_id, quantity, sales!inner(season_id)')
                .eq('sales.season_id', currentSeason.id)

            // Calculate stock per package size
            const stockData = packageSizes?.map(pkg => {
                const purchased = purchaseItems
                    ?.filter(pi => pi.package_size_id === pkg.id)
                    .reduce((sum, pi) => sum + (pi.quantity || 0), 0) || 0
                const sold = saleItems
                    ?.filter(si => si.package_size_id === pkg.id)
                    .reduce((sum, si) => sum + (si.quantity || 0), 0) || 0
                return {
                    id: pkg.id,
                    name: pkg.name,
                    purchased,
                    sold,
                    available: purchased - sold
                }
            }) || []

            setStockSummary(stockData)

        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    const profitLoss = stats.totalSales - stats.totalPurchases - stats.totalExpenses

    if (!currentSeason) {
        return (
            <div className="dashboard">
                <div className="no-season-card">
                    <AlertCircle size={48} className="text-warning" />
                    <h2>No Active Season</h2>
                    <p>Please create a new season to start tracking your mango trade.</p>
                    <Link to="/settings" className="btn btn-primary btn-lg">
                        Go to Settings
                    </Link>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <div className="dashboard">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="text-muted">
                        <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                        {currentSeason.name} ({formatDate(currentSeason.start_date)} - {formatDate(currentSeason.end_date)})
                    </p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                <Link to="/sales" className="quick-action-btn quick-action-sale">
                    <CreditCard size={20} />
                    <span>New Sale</span>
                </Link>
                <Link to="/purchases" className="quick-action-btn quick-action-purchase">
                    <ShoppingCart size={20} />
                    <span>New Purchase</span>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
                        <ShoppingCart size={20} />
                    </div>
                    <div className="stat-value">{formatCurrency(stats.totalPurchases)}</div>
                    <div className="stat-label">Total Purchases</div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                        <CreditCard size={20} />
                    </div>
                    <div className="stat-value">{formatCurrency(stats.totalSales)}</div>
                    <div className="stat-label">Total Sales</div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
                        <Users size={20} />
                    </div>
                    <div className="stat-value">{formatCurrency(stats.farmerDues)}</div>
                    <div className="stat-label">Farmer Dues</div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                        <Wallet size={20} />
                    </div>
                    <div className="stat-value">{formatCurrency(stats.customerOutstanding)}</div>
                    <div className="stat-label">Credit Outstanding</div>
                </div>
            </div>

            {/* Profit/Loss Card */}
            <div className="profit-card">
                <div className="profit-header">
                    <h3>Profit / Loss</h3>
                    {profitLoss >= 0 ? (
                        <TrendingUp size={24} className="text-success" />
                    ) : (
                        <TrendingDown size={24} className="text-danger" />
                    )}
                </div>
                <div className={`profit-value ${profitLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(Math.abs(profitLoss))}
                    <span className="profit-label">{profitLoss >= 0 ? 'Profit' : 'Loss'}</span>
                </div>
                <div className="profit-breakdown">
                    <div className="breakdown-item">
                        <span>Sales</span>
                        <span className="text-success">+{formatCurrency(stats.totalSales)}</span>
                    </div>
                    <div className="breakdown-item">
                        <span>Purchases</span>
                        <span className="text-danger">-{formatCurrency(stats.totalPurchases)}</span>
                    </div>
                    <div className="breakdown-item">
                        <span>Expenses</span>
                        <span className="text-danger">-{formatCurrency(stats.totalExpenses)}</span>
                    </div>
                </div>
            </div>

            {/* Quick Stats Row */}
            <div className="quick-stats">
                <div className="quick-stat-card">
                    <div className="quick-stat-label">Today's Sales</div>
                    <div className="quick-stat-value">{formatCurrency(stats.todaySales)}</div>
                </div>
                <div className="quick-stat-card">
                    <div className="quick-stat-label">Rent (Paid/Total)</div>
                    <div className="quick-stat-value">
                        {formatCurrency(currentSeason.rent_paid || 0)} / {formatCurrency(currentSeason.rent_amount || 0)}
                    </div>
                </div>
            </div>

            {/* Stock Summary */}
            <div className="card stock-summary-card">
                <div className="card-header">
                    <h3 className="card-title">
                        <Package size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                        Stock Summary
                    </h3>
                </div>
                {stockSummary.length === 0 ? (
                    <div className="empty-state">
                        <p>No stock data available</p>
                    </div>
                ) : (
                    <div className="stock-table">
                        <div className="stock-header">
                            <span>Package</span>
                            <span>Purchased</span>
                            <span>Sold</span>
                            <span>Available</span>
                        </div>
                        {stockSummary.map((stock) => (
                            <div key={stock.id} className="stock-row">
                                <span className="stock-name">{stock.name}</span>
                                <span className="stock-purchased">{stock.purchased}</span>
                                <span className="stock-sold">{stock.sold}</span>
                                <span className={`stock-available ${stock.available > 0 ? 'positive' : stock.available < 0 ? 'negative' : ''}`}>
                                    {stock.available}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Recent Sales</h3>
                    <Link to="/receipts" className="btn btn-ghost btn-sm">
                        View All <ArrowRight size={16} />
                    </Link>
                </div>
                {recentActivity.length === 0 ? (
                    <div className="empty-state">
                        <p>No sales yet. Start selling to see activity here!</p>
                    </div>
                ) : (
                    <div className="mobile-cards">
                        {recentActivity.map((sale) => (
                            <div key={sale.id} className="mobile-card">
                                <div className="mobile-card-header">
                                    <span className="mobile-card-title">
                                        {sale.customers?.name || 'Walk-in Customer'}
                                    </span>
                                    <span className="amount">{formatCurrency(sale.total_amount)}</span>
                                </div>
                                <div className="mobile-card-body">
                                    <div className="mobile-card-row">
                                        <span>Invoice</span>
                                        <span>{sale.invoice_number}</span>
                                    </div>
                                    <div className="mobile-card-row">
                                        <span>Date</span>
                                        <span>{formatDate(sale.sale_date)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upcoming Enquiries */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <ClipboardList size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                        Upcoming Enquiries
                    </h3>
                    <Link to="/enquiries" className="btn btn-ghost btn-sm">
                        View All <ArrowRight size={16} />
                    </Link>
                </div>
                {upcomingEnquiries.length === 0 ? (
                    <div className="empty-state">
                        <p>No upcoming enquiries</p>
                    </div>
                ) : (
                    <div className="mobile-cards">
                        {upcomingEnquiries.map((enquiry) => {
                            const customerName = enquiry.customers?.name || enquiry.customer_name || 'Unknown'
                            return (
                                <div key={enquiry.id} className="mobile-card enquiry-preview-card">
                                    <div className="mobile-card-header">
                                        <span className="mobile-card-title">{customerName}</span>
                                        <span className="badge badge-info">
                                            <Calendar size={12} /> {formatDate(enquiry.required_date)}
                                        </span>
                                    </div>
                                    <div className="mobile-card-body">
                                        {enquiry.quantity && enquiry.package_sizes && (
                                            <div className="mobile-card-row">
                                                <span>Order</span>
                                                <span>{enquiry.quantity} × {enquiry.package_sizes.name}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mobile-card-actions">
                                        <button
                                            className="btn btn-success btn-sm"
                                            onClick={() => navigate(`/sales?enquiry_id=${enquiry.id}`)}
                                        >
                                            <ShoppingCart size={14} /> Convert to Sale
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Dashboard
