import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common'
import { formatCurrency, formatDate, getTodayDate, expenseCategoryLabels } from '../utils/helpers'
import './Expenses.css'

function Expenses() {
    const { currentSeason, updateSeason } = useSeason()
    const toast = useToast()
    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingExpense, setEditingExpense] = useState(null)
    const [formLoading, setFormLoading] = useState(false)
    const [filterCategory, setFilterCategory] = useState('all')

    const [form, setForm] = useState({
        category: 'daily',
        description: '',
        amount: '',
        expense_date: getTodayDate()
    })

    // Rent form
    const [rentAmount, setRentAmount] = useState('')

    useEffect(() => {
        if (currentSeason) {
            fetchExpenses()
        } else {
            setLoading(false)
        }
    }, [currentSeason])

    const fetchExpenses = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .eq('season_id', currentSeason.id)
                .order('expense_date', { ascending: false })

            if (error) throw error
            setExpenses(data || [])
        } catch (error) {
            toast.error('Failed to load expenses')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!currentSeason) {
            toast.error('Please create a season first')
            return
        }

        setFormLoading(true)

        try {
            if (editingExpense) {
                const { error } = await supabase
                    .from('expenses')
                    .update({
                        category: form.category,
                        description: form.description,
                        amount: parseFloat(form.amount),
                        expense_date: form.expense_date
                    })
                    .eq('id', editingExpense.id)

                if (error) throw error
                toast.success('Expense updated')
            } else {
                const { error } = await supabase
                    .from('expenses')
                    .insert([{
                        season_id: currentSeason.id,
                        category: form.category,
                        description: form.description,
                        amount: parseFloat(form.amount),
                        expense_date: form.expense_date
                    }])

                if (error) throw error
                toast.success('Expense recorded')
            }

            closeModal()
            fetchExpenses()
        } catch (error) {
            toast.error('Failed to save expense: ' + error.message)
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (expense) => {
        if (!confirm('Delete this expense?')) return

        try {
            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', expense.id)

            if (error) throw error
            toast.success('Expense deleted')
            fetchExpenses()
        } catch (error) {
            toast.error('Failed to delete expense: ' + error.message)
        }
    }

    const handlePayRent = async () => {
        if (!rentAmount || !currentSeason) return

        try {
            const newPaid = (currentSeason.rent_paid || 0) + parseFloat(rentAmount)
            await updateSeason(currentSeason.id, { rent_paid: newPaid })
            setRentAmount('')
            toast.success('Rent payment recorded')
        } catch (error) {
            toast.error('Failed to record rent payment: ' + error.message)
        }
    }

    const openEditModal = (expense) => {
        setEditingExpense(expense)
        setForm({
            category: expense.category,
            description: expense.description,
            amount: expense.amount,
            expense_date: expense.expense_date
        })
        setShowModal(true)
    }

    const openNewModal = () => {
        setEditingExpense(null)
        setForm({
            category: 'daily',
            description: '',
            amount: '',
            expense_date: getTodayDate()
        })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingExpense(null)
        setForm({
            category: 'daily',
            description: '',
            amount: '',
            expense_date: getTodayDate()
        })
    }

    const getCategoryTotal = (category) => {
        return expenses
            .filter(e => e.category === category)
            .reduce((sum, e) => sum + (e.amount || 0), 0)
    }

    const filteredExpenses = filterCategory === 'all'
        ? expenses
        : expenses.filter(e => e.category === filterCategory)

    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)

    if (!currentSeason) {
        return (
            <div className="expenses-page">
                <div className="page-header">
                    <h1 className="page-title">Expenses</h1>
                </div>
                <div className="empty-state">
                    <p>Please create a season in Settings to track expenses.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="expenses-page">
            <div className="page-header">
                <h1 className="page-title">Expenses</h1>
                <button className="btn btn-primary" onClick={openNewModal}>
                    <Plus size={18} /> Add Expense
                </button>
            </div>

            {/* Rent Card */}
            <div className="card rent-card mb-3">
                <div className="card-header">
                    <h3 className="card-title">Shop Rent</h3>
                </div>
                <div className="rent-info">
                    <div className="rent-row">
                        <span>Total Rent</span>
                        <span className="amount">{formatCurrency(currentSeason.rent_amount || 0)}</span>
                    </div>
                    <div className="rent-row">
                        <span>Paid</span>
                        <span className="amount text-success">{formatCurrency(currentSeason.rent_paid || 0)}</span>
                    </div>
                    <div className="rent-row outstanding">
                        <span>Outstanding</span>
                        <span className="amount text-danger">
                            {formatCurrency((currentSeason.rent_amount || 0) - (currentSeason.rent_paid || 0))}
                        </span>
                    </div>
                </div>
                <div className="rent-action">
                    <input
                        type="number"
                        placeholder="Amount to pay"
                        value={rentAmount}
                        onChange={(e) => setRentAmount(e.target.value)}
                        min="1"
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handlePayRent}
                        disabled={!rentAmount}
                    >
                        Pay Rent
                    </button>
                </div>
            </div>

            {/* Expense Summary */}
            <div className="expense-summary">
                <div className="summary-card">
                    <span className="summary-label">Transport</span>
                    <span className="summary-value">{formatCurrency(getCategoryTotal('transport'))}</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">Daily</span>
                    <span className="summary-value">{formatCurrency(getCategoryTotal('daily'))}</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">Delivery</span>
                    <span className="summary-value">{formatCurrency(getCategoryTotal('delivery'))}</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">Misc</span>
                    <span className="summary-value">{formatCurrency(getCategoryTotal('misc'))}</span>
                </div>
            </div>

            <div className="total-expenses">
                Total Expenses: <strong>{formatCurrency(totalExpenses)}</strong>
            </div>

            {/* Filter */}
            <div className="filter-tabs">
                <button
                    className={`filter-tab ${filterCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterCategory('all')}
                >
                    All
                </button>
                {Object.entries(expenseCategoryLabels).filter(([k]) => k !== 'rent').map(([key, label]) => (
                    <button
                        key={key}
                        className={`filter-tab ${filterCategory === key ? 'active' : ''}`}
                        onClick={() => setFilterCategory(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Expenses List */}
            {loading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : filteredExpenses.length === 0 ? (
                <div className="empty-state">
                    <p>{filterCategory === 'all' ? 'No expenses recorded yet' : 'No expenses in this category'}</p>
                </div>
            ) : (
                <div className="mobile-cards">
                    {filteredExpenses.map((expense) => (
                        <div key={expense.id} className="mobile-card expense-card">
                            <div className="mobile-card-header">
                                <div>
                                    <span className="mobile-card-title">{expense.description}</span>
                                    <span className={`badge badge-info`}>
                                        {expenseCategoryLabels[expense.category]}
                                    </span>
                                </div>
                                <span className="amount text-danger">{formatCurrency(expense.amount)}</span>
                            </div>
                            <div className="mobile-card-body">
                                <div className="mobile-card-row">
                                    <span>Date</span>
                                    <span>{formatDate(expense.expense_date)}</span>
                                </div>
                            </div>
                            <div className="mobile-card-actions">
                                <button className="btn btn-outline btn-sm" onClick={() => openEditModal(expense)}>
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(expense)}>
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={closeModal}
                title={editingExpense ? 'Edit Expense' : 'Add Expense'}
                footer={
                    <>
                        <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit} disabled={formLoading}>
                            {formLoading ? 'Saving...' : 'Save'}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Category *</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            required
                        >
                            <option value="transport">Transport</option>
                            <option value="daily">Daily Expenses</option>
                            <option value="delivery">Delivery</option>
                            <option value="misc">Miscellaneous</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Description *</label>
                        <input
                            type="text"
                            placeholder="What was this expense for?"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Amount (₹) *</label>
                            <input
                                type="number"
                                placeholder="0"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                min="1"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Date *</label>
                            <input
                                type="date"
                                value={form.expense_date}
                                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Expenses
