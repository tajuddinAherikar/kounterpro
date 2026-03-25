// Expense Tracker for KounterPro
let allExpenses = [];
let expenseChart = null;
let categoryChart = null;

// Format number in Indian currency
function formatIndianCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('💰 Expenses page loading...');
    
    try {
        // Try to get current user with error handling
        let user = null;
        try {
            user = await supabaseGetCurrentUser();
        } catch (userError) {
            console.error('Error getting current user:', userError);
            user = null;
        }

        if (!user) {
            console.warn('⚠️ User not authenticated in expenses');
            setTimeout(() => {
                if (!user) {
                    window.location.href = 'login.html';
                }
            }, 1000);
            return;
        }

        console.log('✅ User authenticated, loading expenses...');

        // Load expenses
        await loadExpenses();
        console.log(`💾 Loaded ${allExpenses.length} expenses`);
        
        // Render page
        renderExpensesPage();
        
        // Setup sidebar and notifications
        setupSidebarToggle();
        setupNotificationListener();
        
        // Set today's date as default in form
        document.getElementById('expenseDate').valueAsDate = new Date();
        
        console.log('✅ Expenses page fully loaded');
    } catch (error) {
        console.error('Error initializing expenses:', error);
        showError('Failed to load expenses: ' + error.message);
    }
});

// Load expenses from Supabase
async function loadExpenses() {
    const result = await supabaseGetExpenses();
    if (result.success) {
        allExpenses = result.data || [];
    } else {
        console.error('Failed to load expenses:', result.error);
        allExpenses = [];
    }
}

// Render entire expenses page
function renderExpensesPage() {
    if (allExpenses.length === 0) {
        document.getElementById('expensesTableBody').innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">No expenses yet. Add your first expense to get started!</td></tr>';
        document.getElementById('expenseChart').style.display = 'none';
        document.getElementById('categoryChart').style.display = 'none';
        updateExpenseStats();
        return;
    }

    // Update stats
    updateExpenseStats();
    
    // Render charts
    renderExpenseChart();
    renderCategoryChart();
    
    // Render table
    renderExpensesTable();
}

// Update statistics
function updateExpenseStats() {
    const totalExpenses = allExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const expenseCount = allExpenses.length;
    
    // Current month expenses
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthExpenses = allExpenses.reduce((sum, exp) => {
        const date = new Date(exp.date);
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            return sum + parseFloat(exp.amount || 0);
        }
        return sum;
    }, 0);

    // Top category
    const categoryTotals = {};
    allExpenses.forEach(exp => {
        const cat = exp.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(exp.amount || 0);
    });
    
    const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

    document.getElementById('totalExpenses').textContent = formatIndianCurrency(totalExpenses);
    document.getElementById('expenseCount').textContent = `${expenseCount} expense${expenseCount !== 1 ? 's' : ''}`;
    document.getElementById('monthExpenses').textContent = formatIndianCurrency(monthExpenses);
    
    if (topCat) {
        document.getElementById('topCategory').textContent = topCat[0];
        document.getElementById('topCategoryAmount').textContent = formatIndianCurrency(topCat[1]);
    } else {
        document.getElementById('topCategory').textContent = '-';
        document.getElementById('topCategoryAmount').textContent = '₹0';
    }
}

// Render monthly trend chart
function renderExpenseChart() {
    const monthlyData = {};
    
    allExpenses.forEach(exp => {
        const date = new Date(exp.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthDisplay = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                display: monthDisplay,
                amount: 0
            };
        }
        monthlyData[monthKey].amount += parseFloat(exp.amount || 0);
    });

    const sorted = Object.keys(monthlyData).sort();
    const chartData = sorted.map(key => monthlyData[key]);

    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    if (expenseChart) expenseChart.destroy();

    expenseChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => d.display),
            datasets: [{
                label: 'Monthly Expenses',
                data: chartData.map(d => d.amount),
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#e74c3c',
                pointBorderColor: 'white',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `₹${ctx.parsed.y.toLocaleString('en-IN')}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `₹${value.toLocaleString('en-IN')}`
                    }
                }
            }
        }
    });
}

// Render category breakdown chart
function renderCategoryChart() {
    const categoryTotals = {};
    
    allExpenses.forEach(exp => {
        const cat = exp.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(exp.amount || 0);
    });

    const categoryEmojis = {
        'Supplies': '📦',
        'Labor': '👷',
        'Utilities': '💡',
        'Transport': '🚚',
        'Other': '📌',
        'Miscellaneous': '🔧'
    };

    const categories = Object.keys(categoryTotals);
    const amounts = Object.values(categoryTotals);

    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories.map(c => `${categoryEmojis[c] || '📌'} ${c}`),
            datasets: [{
                data: amounts,
                backgroundColor: [
                    'rgba(231, 76, 60, 0.8)',   // Red
                    'rgba(230, 126, 34, 0.8)',  // Orange
                    'rgba(241, 196, 15, 0.8)',  // Yellow
                    'rgba(52, 152, 219, 0.8)',  // Blue
                    'rgba(155, 89, 182, 0.8)',  // Purple
                    'rgba(26, 188, 156, 0.8)'   // Green
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { padding: 15 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `₹${ctx.parsed.toLocaleString('en-IN')}`
                    }
                }
            }
        }
    });
}

// Render expenses table
function renderExpensesTable() {
    // Sort by date descending
    const sorted = [...allExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    let html = '';
    sorted.forEach((exp, idx) => {
        const date = new Date(exp.date).toLocaleDateString('en-IN');
        const amount = formatIndianCurrency(exp.amount);
        
        html += `
            <tr class="expense-row">
                <td>${date}</td>
                <td>${exp.description}</td>
                <td><span style="background: #ecf0f1; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${exp.category}</span></td>
                <td>${amount}</td>
                <td>
                    <a href="#" class="action-link edit-link" onclick="editExpense('${exp.id}'); return false;" title="Edit">
                        <span class="material-icons">edit</span> Edit
                    </a>
                    <a href="#" class="action-link delete-link" onclick="deleteExpense('${exp.id}'); return false;" title="Delete">
                        <span class="material-icons">delete</span> Delete
                    </a>
                </td>
            </tr>
        `;
    });

    document.getElementById('expensesTableBody').innerHTML = html;
}

// ============ MODAL FUNCTIONS ============
function showAddExpenseForm() {
    document.getElementById('modalTitle').textContent = 'Add Expense';
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseId').value = '';
    document.getElementById('expenseDate').valueAsDate = new Date();
    document.getElementById('expenseModal').classList.add('show');
}

function closeExpenseModal() {
    document.getElementById('expenseModal').classList.remove('show');
    document.getElementById('expenseForm').reset();
}

function editExpense(id) {
    const expense = allExpenses.find(e => e.id === id);
    if (!expense) return;

    document.getElementById('modalTitle').textContent = 'Edit Expense';
    document.getElementById('expenseId').value = expense.id;
    document.getElementById('expenseAmount').value = parseFloat(expense.amount || 0).toFixed(2);
    document.getElementById('expenseDescription').value = expense.description;
    document.getElementById('expenseCategory').value = expense.category;
    document.getElementById('expenseDate').value = expense.date;
    
    document.getElementById('expenseModal').classList.add('show');
}

// ============ FORM SUBMISSION ============
document.getElementById('expenseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('expenseId').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDescription').value;
    const category = document.getElementById('expenseCategory').value;
    const date = document.getElementById('expenseDate').value;

    if (!amount || !description || !category || !date) {
        showError('Please fill in all fields');
        return;
    }

    const expenseData = {
        amount,
        description,
        category,
        date
    };

    // Close modal immediately for better UX
    closeExpenseModal();

    let result;
    if (id) {
        // Update
        result = await supabaseUpdateExpense(id, expenseData);
        if (result.success) {
            showSuccess('Expense updated successfully');
            // Update local array
            const idx = allExpenses.findIndex(e => e.id === id);
            if (idx >= 0) {
                allExpenses[idx] = { ...allExpenses[idx], ...expenseData };
            }
        } else {
            showError('Failed to update expense: ' + result.error);
            return;
        }
    } else {
        // Create
        result = await supabaseAddExpense(expenseData);
        if (result.success) {
            showSuccess('Expense added successfully');
            // Add to local array with returned ID
            if (result.data?.id) {
                allExpenses.push({
                    id: result.data.id,
                    ...expenseData
                });
            }
        } else {
            showError('Failed to add expense: ' + result.error);
            return;
        }
    }

    // Update UI immediately without waiting
    updateExpenseStats();
    renderExpensesTable();
    
    // Refresh charts in background
    renderExpenseChart();
    renderCategoryChart();
});

// Delete expense
async function deleteExpense(id) {
    const confirmed = await showDeleteConfirm('this expense');
    if (!confirmed) return;

    const result = await supabaseDeleteExpense(id);
    if (result.success) {
        showSuccess('Expense deleted successfully');
        // Remove from local array
        allExpenses = allExpenses.filter(e => e.id !== id);
        // Update UI immediately
        updateExpenseStats();
        renderExpensesTable();
        renderExpenseChart();
        renderCategoryChart();
    } else {
        showError('Failed to delete expense: ' + result.error);
    }
}

// Export CSV
function exportExpensesData() {
    if (allExpenses.length === 0) {
        showWarning('No expenses to export');
        return;
    }

    let csv = 'Expense Report\n';
    csv += `Generated: ${new Date().toLocaleDateString('en-IN')}\n\n`;
    csv += 'Date,Description,Category,Amount\n';

    [...allExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(exp => {
        const date = new Date(exp.date).toLocaleDateString('en-IN');
        csv += `"${date}","${exp.description}","${exp.category}",${exp.amount}\n`;
    });

    const totalAmount = allExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    csv += `\nTotal,,${totalAmount}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showSuccess('Expenses exported to CSV');
}

// ============ SIDEBAR & NOTIFICATIONS ============
function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay?.classList.toggle('active');
        });
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
}

function setupNotificationListener() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (notificationDropdown) {
                notificationDropdown.classList.toggle('show');
            }
        });
    }
    
    if (notificationDropdown) {
        document.addEventListener('click', (e) => {
            if (!notificationDropdown.contains(e.target) && (notificationBtn && !notificationBtn.contains(e.target))) {
                notificationDropdown.classList.remove('show');
            }
        });
    }
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeExpenseModal();
    }
});

// Close modal when clicking outside of modal content
window.addEventListener('click', (e) => {
    const modal = document.getElementById('expenseModal');
    if (e.target === modal) {
        closeExpenseModal();
    }
});
