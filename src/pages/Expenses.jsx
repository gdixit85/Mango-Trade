import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { useSeason } from '../context/SeasonContext'
import { supabase } from '../services/supabase'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common'
import { formatCurrency, formatDate, getTodayDate } from '../utils/helpers'
import './Expenses.css'

function Expenses() {
    const { currentSeason, updateSeason } = useSeason()
    const toast = useToast()
    const [expenses, setExpenses] = useState([])
    const [expenseHeads, setExpenseHeads] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingExpense, setEditingExpense] = useState(null)
    const [formLoading, setFormLoading] = useState(false)
    const [filterCategory, setFilterCategory] = useState('all')

    const [form, setForm] = useState({
        expense_head_id: '',
        description: '',
        amount: '',
        expense_date: getTodayDate()
    })

    // Rent form
    const [rentAmount, setRentAmount] = useState('')

    useEffect(() => {
        fetchExpenseHeads()
        if (currentSeason) {
            fetchExpenses()
        } else {
            setLoading(false)
        }
    }, [currentSeason])

    const fetchExpenseHeads = async () => {
        try {
            const { data, error } = await supabase
                .from('expense_heads')
                .select('*')
                .eq('is_active', true)
                .order('is_system', { ascending: false })
                .order('name')

            if (error) throw error
            setExpenseHeads(data || [])
        } catch (error) {
            console.error('Error fetching expense heads:', error)
        }
    }

    const fetchExpenses = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('expenses')
                .select('*, expense_heads(id, name)')
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

        if (!form.expense_head_id) {
            toast.error('Please select an expense category')
            return
        }

        setFormLoading(true)

        try {
            // Get the category name from expense head for backwards compatibility
            const selectedHead = expenseHeads.find(h => h.id === form.expense_head_id)
            const categoryName = selectedHead?.name?.toLowerCase() || 'misc'

            if (editingExpense) {
                const { error } = await supabase
                    .from('expenses')
                    .update({
                        expense_head_id: form.expense_head_id,
                        category: categoryName,
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
                        expense_head_id: form.expense_head_id,
                        category: categoryName,
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
            expense_head_id: expense.expense_head_id || '',
            description: expense.description,
            amount: expense.amount,
            expense_date: expense.expense_date
        })
        setShowModal(true)
    }

    const openNewModal = () => {
        setEditingExpense(null)
        // Default to first expense head if available
        const defaultHeadId = expenseHeads.length > 0 ? expenseHeads[0].id : ''
        setForm({
            expense_head_id: defaultHeadId,
            description: '',
            amount: '',
            expense_date: getTodayDate()
        })
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setEditingExpense(null)
        const defaultHeadId = expenseHeads.length > 0 ? expenseHeads[0].id : ''
        setForm({
            expense_head_id: defaultHeadId,
            description: '',
            amount: '',
            expense_date: getTodayDate()
        })
    }

    const getCategoryTotal = (headId) => {
        return expenses
            .filter(e => e.expense_head_id === headId)
            .reduce((sum, e) => sum + (e.amount || 0), 0)
    }

    const getExpenseHeadName = (expense) => {
        if (expense.expense_heads?.name) return expense.expense_heads.name
        // Fallback to old category field
        return expense.category ? expense.category.charAt(0).toUpperCase() + expense.category.slice(1) : 'Unknown'
    }

    const filteredExpenses = filterCategory === 'all'
        ? expenses
        : expenses.filter(e => e.expense_head_id === filterCategory)

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
                {expenseHeads.filter(h => h.name.toLowerCase() !== 'rent').map((head) => (
                    <div key={head.id} className="summary-card">
                        <span className="summary-label">{head.name}</span>
                        <span className="summary-value">{formatCurrency(getCategoryTotal(head.id))}</span>
                    </div>
                ))}
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
                {expenseHeads.filter(h => h.name.toLowerCase() !== 'rent').map((head) => (
                    <button
                        key={head.id}
                        className={`filter-tab ${filterCategory === head.id ? 'active' : ''}`}
                        onClick={() => setFilterCategory(head.id)}
                    >
                        {head.name}
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
                                        {getExpenseHeadName(expense)}
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
                            value={form.expense_head_id}
                            onChange={(e) => setForm({ ...form, expense_head_id: e.target.value })}
                            required
                        >
                            <option value="">Select Category</option>
                            {expenseHeads.filter(h => h.name.toLowerCase() !== 'rent').map((head) => (
                                <option key={head.id} value={head.id}>{head.name}</option>
                            ))}
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
