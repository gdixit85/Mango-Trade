import { useState, useEffect } from 'react'
import { FileSpreadsheet, TrendingUp, Users, CreditCard, Download } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { formatCurrency, formatDate, customerTypeLabels } from '../utils/helpers'
import { exportToExcel, exportCreditLedger } from '../utils/exportExcel'
import './Reports.css'

function Reports() {
    const { currentSeason } = useSeason()
    const toast = useToast()
    const [activeReport, setActiveReport] = useState('profitloss')
    const [loading, setLoading] = useState(true)

    // Report Data
    const [profitLossData, setProfitLossData] = useState(null)
    const [creditCustomers, setCreditCustomers] = useState([])
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [customerLedger, setCustomerLedger] = useState([])
    const [farmerDues, setFarmerDues] = useState([])

    useEffect(() => {
        if (currentSeason) {
            if (activeReport === 'profitloss') fetchProfitLoss()
            if (activeReport === 'credit') fetchCreditCustomers()
            if (activeReport === 'farmers') fetchFarmerDues()
        } else {
            setLoading(false)
        }
    }, [currentSeason, activeReport])

    const fetchProfitLoss = async () => {
        try {
            setLoading(true)

            // Fetch purchases
            const { data: purchases } = await supabase
                .from('purchases')
                .select('total_amount')
                .eq('season_id', currentSeason.id)
            const totalPurchases = purchases?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0

            // Fetch sales
            const { data: sales } = await supabase
                .from('sales')
                .select('total_amount')
                .eq('season_id', currentSeason.id)
            const totalSales = sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0

            // Fetch expenses
            const { data: expenses } = await supabase
                .from('expenses')
                .select('amount, category')
                .eq('season_id', currentSeason.id)

            const expensesByCategory = {}
            expenses?.forEach(e => {
                expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + (e.amount || 0)
            })
            const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

            // Rent
            const rentPaid = currentSeason.rent_paid || 0

            setProfitLossData({
                totalSales,
                totalPurchases,
                totalExpenses,
                rentPaid,
                expensesByCategory,
                grossProfit: totalSales - totalPurchases,
                netProfit: totalSales - totalPurchases - totalExpenses - rentPaid
            })
        } catch (error) {
            toast.error('Failed to load report')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const fetchCreditCustomers = async () => {
        try {
            setLoading(true)
            const { data } = await supabase
                .from('customers')
                .select('*')
                .eq('type', 'credit')
                .order('name')

            setCreditCustomers(data || [])
        } catch (error) {
            toast.error('Failed to load customers')
        } finally {
            setLoading(false)
        }
    }

    const fetchCustomerLedger = async (customer) => {
        setSelectedCustomer(customer)
        setLoading(true)

        try {
            // Fetch sales
            const { data: sales } = await supabase
                .from('sales')
                .select(`
          id,
          sale_date,
          invoice_number,
          total_amount,
          sale_items (
            quantity,
            rate_per_dozen,
            package_sizes (name)
          )
        `)
                .eq('customer_id', customer.id)
                .eq('season_id', currentSeason.id)
                .order('sale_date', { ascending: true })

            // Fetch payments
            const { data: payments } = await supabase
                .from('customer_payments')
                .select('*')
                .eq('customer_id', customer.id)
                .eq('season_id', currentSeason.id)
                .order('payment_date', { ascending: true })

            // Build ledger
            const entries = []
            let balance = 0

            // Combine and sort by date
            const allItems = [
                ...(sales || []).map(s => ({
                    type: 'sale',
                    date: s.sale_date,
                    data: s
                })),
                ...(payments || []).map(p => ({
                    type: 'payment',
                    date: p.payment_date,
                    data: p
                }))
            ].sort((a, b) => new Date(a.date) - new Date(b.date))

            allItems.forEach(item => {
                if (item.type === 'sale') {
                    const sale = item.data
                    const description = sale.sale_items?.map(si =>
                        `${si.package_sizes?.name} × ${si.quantity}`
                    ).join(', ')

                    balance += sale.total_amount
                    entries.push({
                        date: formatDate(sale.sale_date),
                        description: description || sale.invoice_number,
                        type: 'Sale',
                        debit: sale.total_amount,
                        credit: 0,
                        balance
                    })
                } else {
                    const payment = item.data
                    balance -= payment.amount
                    entries.push({
                        date: formatDate(payment.payment_date),
                        description: `Payment (${payment.payment_mode})`,
                        type: 'Payment',
                        debit: 0,
                        credit: payment.amount,
                        balance
                    })
                }
            })

            setCustomerLedger(entries)
        } catch (error) {
            toast.error('Failed to load ledger')
        } finally {
            setLoading(false)
        }
    }

    const fetchFarmerDues = async () => {
        try {
            setLoading(true)
            const { data } = await supabase
                .from('farmers')
                .select('*')
                .order('name')

            setFarmerDues(data || [])
        } catch (error) {
            toast.error('Failed to load farmers')
        } finally {
            setLoading(false)
        }
    }

    const exportProfitLoss = () => {
        if (!profitLossData) return

        const data = [
            { Category: 'Total Sales', Amount: profitLossData.totalSales },
            { Category: 'Total Purchases', Amount: profitLossData.totalPurchases },
            { Category: 'Gross Profit', Amount: profitLossData.grossProfit },
            { Category: '', Amount: '' },
            { Category: 'Expenses:', Amount: '' },
            ...Object.entries(profitLossData.expensesByCategory).map(([cat, amt]) => ({
                Category: `  ${cat}`, Amount: amt
            })),
            { Category: '  Rent', Amount: profitLossData.rentPaid },
            { Category: 'Total Expenses', Amount: profitLossData.totalExpenses + profitLossData.rentPaid },
            { Category: '', Amount: '' },
            { Category: 'NET PROFIT/LOSS', Amount: profitLossData.netProfit }
        ]

        exportToExcel(data, `ProfitLoss_${currentSeason.name}`, 'Profit & Loss')
        toast.success('Exported successfully')
    }

    const exportCustomerLedger = () => {
        if (!selectedCustomer || customerLedger.length === 0) return

        const outstanding = (selectedCustomer.total_outstanding || 0) - (selectedCustomer.total_paid || 0)
        exportCreditLedger(
            selectedCustomer,
            customerLedger,
            {
                totalPurchases: selectedCustomer.total_outstanding || 0,
                totalPayments: selectedCustomer.total_paid || 0,
                outstanding
            }
        )
        toast.success('Exported successfully')
    }

    const exportFarmerDues = () => {
        const data = farmerDues.map(f => ({
            'Farmer Name': f.name,
            'Phone': f.phone || '',
            'Village': f.village || '',
            'Total Credit': f.total_credit || 0,
            'Total Paid': f.total_paid || 0,
            'Outstanding': (f.total_credit || 0) - (f.total_paid || 0)
        }))

        exportToExcel(data, `FarmerDues_${currentSeason.name}`, 'Farmer Dues')
        toast.success('Exported successfully')
    }

    if (!currentSeason) {
        return (
            <div className="reports-page">
                <div className="page-header">
                    <h1 className="page-title">Reports</h1>
                </div>
                <div className="empty-state">
                    <p>Please create a season in Settings to view reports.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="reports-page">
            <div className="page-header">
                <h1 className="page-title">Reports</h1>
            </div>

            {/* Report Tabs */}
            <div className="report-tabs">
                <button
                    className={`report-tab ${activeReport === 'profitloss' ? 'active' : ''}`}
                    onClick={() => setActiveReport('profitloss')}
                >
                    <TrendingUp size={18} />
                    <span>Profit/Loss</span>
                </button>
                <button
                    className={`report-tab ${activeReport === 'credit' ? 'active' : ''}`}
                    onClick={() => setActiveReport('credit')}
                >
                    <CreditCard size={18} />
                    <span>Credit Ledger</span>
                </button>
                <button
                    className={`report-tab ${activeReport === 'farmers' ? 'active' : ''}`}
                    onClick={() => setActiveReport('farmers')}
                >
                    <Users size={18} />
                    <span>Farmer Dues</span>
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : (
                <>
                    {/* Profit/Loss Report */}
                    {activeReport === 'profitloss' && profitLossData && (
                        <div className="report-content">
                            <div className="report-header">
                                <h2>Profit & Loss Statement</h2>
                                <button className="btn btn-outline btn-sm" onClick={exportProfitLoss}>
                                    <Download size={16} /> Export
                                </button>
                            </div>

                            <div className="pl-section">
                                <div className="pl-row">
                                    <span>Total Sales Revenue</span>
                                    <span className="amount text-success">{formatCurrency(profitLossData.totalSales)}</span>
                                </div>
                                <div className="pl-row">
                                    <span>Cost of Goods (Purchases)</span>
                                    <span className="amount text-danger">-{formatCurrency(profitLossData.totalPurchases)}</span>
                                </div>
                                <div className="pl-row pl-subtotal">
                                    <span>Gross Profit</span>
                                    <span className={`amount ${profitLossData.grossProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatCurrency(profitLossData.grossProfit)}
                                    </span>
                                </div>
                            </div>

                            <div className="pl-section">
                                <h4>Operating Expenses</h4>
                                {Object.entries(profitLossData.expensesByCategory).map(([category, amount]) => (
                                    <div key={category} className="pl-row pl-expense">
                                        <span>{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                                        <span className="amount">{formatCurrency(amount)}</span>
                                    </div>
                                ))}
                                <div className="pl-row pl-expense">
                                    <span>Rent Paid</span>
                                    <span className="amount">{formatCurrency(profitLossData.rentPaid)}</span>
                                </div>
                                <div className="pl-row pl-subtotal">
                                    <span>Total Expenses</span>
                                    <span className="amount text-danger">
                                        -{formatCurrency(profitLossData.totalExpenses + profitLossData.rentPaid)}
                                    </span>
                                </div>
                            </div>

                            <div className="pl-section pl-total">
                                <div className="pl-row">
                                    <span>Net {profitLossData.netProfit >= 0 ? 'Profit' : 'Loss'}</span>
                                    <span className={`amount ${profitLossData.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {formatCurrency(Math.abs(profitLossData.netProfit))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Credit Ledger */}
                    {activeReport === 'credit' && (
                        <div className="report-content">
                            {!selectedCustomer ? (
                                <>
                                    <div className="report-header">
                                        <h2>Credit Customers</h2>
                                    </div>
                                    {creditCustomers.length === 0 ? (
                                        <div className="empty-state">
                                            <p>No credit customers found</p>
                                        </div>
                                    ) : (
                                        <div className="mobile-cards">
                                            {creditCustomers.map((customer) => {
                                                const outstanding = (customer.total_outstanding || 0) - (customer.total_paid || 0)
                                                return (
                                                    <div
                                                        key={customer.id}
                                                        className="mobile-card customer-select-card"
                                                        onClick={() => fetchCustomerLedger(customer)}
                                                    >
                                                        <div className="mobile-card-header">
                                                            <span className="mobile-card-title">{customer.name}</span>
                                                            <span className={`amount ${outstanding > 0 ? 'text-danger' : 'text-success'}`}>
                                                                {formatCurrency(outstanding)}
                                                            </span>
                                                        </div>
                                                        <div className="mobile-card-body">
                                                            <div className="mobile-card-row">
                                                                <span>Total Purchases</span>
                                                                <span>{formatCurrency(customer.total_outstanding || 0)}</span>
                                                            </div>
                                                            <div className="mobile-card-row">
                                                                <span>Total Paid</span>
                                                                <span>{formatCurrency(customer.total_paid || 0)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="report-header">
                                        <button className="btn btn-ghost" onClick={() => setSelectedCustomer(null)}>
                                            ← Back
                                        </button>
                                        <h2>{selectedCustomer.name}</h2>
                                        <button className="btn btn-outline btn-sm" onClick={exportCustomerLedger}>
                                            <Download size={16} /> Export
                                        </button>
                                    </div>

                                    <div className="ledger-summary">
                                        <div>
                                            <span className="label">Total Purchases</span>
                                            <span className="value">{formatCurrency(selectedCustomer.total_outstanding || 0)}</span>
                                        </div>
                                        <div>
                                            <span className="label">Total Paid</span>
                                            <span className="value text-success">{formatCurrency(selectedCustomer.total_paid || 0)}</span>
                                        </div>
                                        <div>
                                            <span className="label">Outstanding</span>
                                            <span className="value text-danger">
                                                {formatCurrency((selectedCustomer.total_outstanding || 0) - (selectedCustomer.total_paid || 0))}
                                            </span>
                                        </div>
                                    </div>

                                    {customerLedger.length === 0 ? (
                                        <div className="empty-state">
                                            <p>No transactions found</p>
                                        </div>
                                    ) : (
                                        <div className="table-container">
                                            <table className="data-table ledger-table">
                                                <thead>
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Description</th>
                                                        <th>Debit</th>
                                                        <th>Credit</th>
                                                        <th>Balance</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {customerLedger.map((entry, idx) => (
                                                        <tr key={idx}>
                                                            <td>{entry.date}</td>
                                                            <td>{entry.description}</td>
                                                            <td className="text-danger">{entry.debit ? formatCurrency(entry.debit) : '-'}</td>
                                                            <td className="text-success">{entry.credit ? formatCurrency(entry.credit) : '-'}</td>
                                                            <td className={entry.balance > 0 ? 'text-danger' : 'text-success'}>
                                                                {formatCurrency(entry.balance)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Farmer Dues */}
                    {activeReport === 'farmers' && (
                        <div className="report-content">
                            <div className="report-header">
                                <h2>Farmer Dues</h2>
                                <button className="btn btn-outline btn-sm" onClick={exportFarmerDues}>
                                    <Download size={16} /> Export
                                </button>
                            </div>

                            {farmerDues.length === 0 ? (
                                <div className="empty-state">
                                    <p>No farmers found</p>
                                </div>
                            ) : (
                                <div className="mobile-cards">
                                    {farmerDues.map((farmer) => {
                                        const outstanding = (farmer.total_credit || 0) - (farmer.total_paid || 0)
                                        return (
                                            <div key={farmer.id} className="mobile-card">
                                                <div className="mobile-card-header">
                                                    <span className="mobile-card-title">{farmer.name}</span>
                                                    <span className={`amount ${outstanding > 0 ? 'text-danger' : 'text-success'}`}>
                                                        {formatCurrency(outstanding)}
                                                    </span>
                                                </div>
                                                <div className="mobile-card-body">
                                                    {farmer.village && (
                                                        <div className="mobile-card-row">
                                                            <span>Village</span>
                                                            <span>{farmer.village}</span>
                                                        </div>
                                                    )}
                                                    <div className="mobile-card-row">
                                                        <span>Total Credit</span>
                                                        <span>{formatCurrency(farmer.total_credit || 0)}</span>
                                                    </div>
                                                    <div className="mobile-card-row">
                                                        <span>Total Paid</span>
                                                        <span>{formatCurrency(farmer.total_paid || 0)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default Reports
