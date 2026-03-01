# KounterPro - Billing Software

A modern, professional billing/invoicing software for managing sales, expenses, and customer relationships. Includes invoice generation, inventory tracking, expense management, and customer analytics.

## 🌟 Key Features

### Dashboard (index.html)
- **Sales Overview**: View today's sales, total units sold, and all-time sales
- **Sales Filtering**: Filter invoices by date range to view historical data
- **Invoice Management**: View and delete invoices with quick actions
- **Quick Access**: Create new bills with a single click
- **Low Stock Alerts**: Real-time notifications for out-of-stock and low-stock items
- **Data Backup**: Export all data to JSON file for safekeeping
- **Data Restore**: Import backup files to restore data

### Customers (customers.html)
- **Customer Database**: Add, edit, and delete customer profiles
- **Customer Information**: Store name, mobile, email, address, and GST number
- **Customer Ledger**: View complete payment history and transaction analytics per customer
- **Quick Statistics**: Total customers, active customers, GST-registered customers
- **Search & Filter**: Find customers by name, mobile, or GST number
- **Ledger Analytics**: Monthly spending trends, total spent, average order value
- **CSV Export**: Download individual customer ledgers for accounting

### Expenses (expenses.html)
- **Expense Tracking**: Add, edit, and delete business expenses
- **Expense Categories**: Categorize expenses (rent, utilities, salary, etc.)
- **Monthly Statistics**: View total and monthly expense breakdowns
- **Visual Analytics**: Line chart for trends, doughnut chart for categories
- **Fast Operations**: Optimized modal forms with instant feedback
- **Dark Mode Support**: Full dark theme compatibility
- **Custom Delete Dialogs**: Confirm before deleting expenses

### Customer Ledger (customer-ledger.html)
- **Payment History**: View complete transaction history for any customer
- **Customer Analytics**: Total spent, invoice count, last purchase, average order
- **Purchase Timeline**: Interactive bar chart showing monthly spending patterns
- **Invoice Details**: View individual invoices with item counts and amounts
- **CSV Export**: Download customer's complete transaction history
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### Inventory Management (inventory.html)
- **Product Database**: Add, edit, and delete products
- **Stock Tracking**: Real-time stock levels with low stock indicators
- **Auto-deduction**: Stock automatically reduces when invoices are created
- **Search**: Find products quickly by name or description
- **Data Backup**: Same backup/restore functionality as dashboard

### Create Invoice (create-bill.html)
- **Customer Details**: Name, address, mobile number, and optional GST number
- **Dynamic Item Table**: Add/remove items with automatic calculations
- **Product Autocomplete**: Type-ahead suggestions from inventory
- **Customizable GST**: Adjust GST rate (default 18%)
- **Auto-calculation**: Real-time calculation of subtotal, GST, and grand total
- **PDF Generation**: Download professional tax invoices in PDF format
- **WhatsApp Integration**: Send invoice details directly via WhatsApp
- **Terms & Conditions**: Pre-filled terms that can be edited

## How to Use

### Starting the Application
1. Open `index.html` in any modern web browser (Chrome, Firefox, Edge)
2. No installation or server setup required!

### Creating a New Invoice
1. Click "Create New Bill" button on the dashboard
2. Fill in customer details:
   - Customer Name (required)
   - Customer Address (required)
   - Customer GST No (optional)
3. Add invoice items:
   - Enter description, quantity, and rate
   - Click "+ Add Item" to add more rows
   - Click "✕" to remove items (minimum 1 required)
4. Adjust GST rate if needed (default is 18%)
5. Edit terms and conditions if needed
6. Click "Generate Invoice PDF" to create and download the invoice
7. Invoice is automatically saved to dashboard

### Viewing Sales Data
1. Dashboard shows today's sales automatically
2. Use date filters to view sales for specific periods:
   - Select "From Date" and "To Date"
   - Click "Filter" to apply
   - Click "Clear" to reset
3. View individual invoices by clicking "View"
4. Delete invoices by clicking "Delete"

### Backing Up Your Data (Important!)
1. **Creating a Backup**:
   - Click "💾 Backup Data" button on Dashboard or Inventory page
   - A JSON file will be downloaded (e.g., `KounterPro_Backup_2026-02-09.json`)
   - Store this file safely (Google Drive, Dropbox, USB drive, etc.)
   - Recommendation: Create weekly backups

2. **Restoring from Backup**:
   - Click "📂 Restore Data" button
   - Select your backup JSON file
   - Confirm the restore (this will replace current data)
   - Page will automatically reload with restored data

3. **Why Backup?**:
   - Browser data can be accidentally cleared
   - Protection against computer crashes
   - Transfer data to a new computer
   - Keep historical archives

### Managing Inventory
1. Click "📦 Inventory" from dashboard
2. Add products with name, description, rate, and stock quantity
3. Edit or delete existing products
4. Stock automatically reduces when creating invoices
5. Low stock items (< 10 units) are highlighted in yellow

## Technical Details

### Technologies Used
- HTML5, CSS3, JavaScript (Vanilla - no frameworks)
- jsPDF library for PDF generation
- localStorage for data persistence

### Data Storage
- All invoices and inventory are stored in browser's localStorage
- Data persists across browser sessions
- No backend or database required
- **Important**: Backup regularly to prevent data loss
- LocalStorage has 5-10MB limit (sufficient for thousands of invoices)

### Invoice Format
- Professional tax invoice layout
- Company details (Dynamic)
- Customer information
- Itemized product list
- GST calculation breakdown
- Terms and conditions
- Stamp/seal placeholder

## 📁 Project File Structure

```
kounterpro/
├── src/
│   ├── pages/
│   │   ├── 404.html                    # 404 error page
│   │   ├── create-bill.html            # Invoice/bill creation
│   │   ├── customers.html              # Customer management
│   │   ├── customer-ledger.html        # Customer payment history
│   │   ├── expenses.html               # Expense tracking
│   │   ├── forgot-password.html        # Password recovery
│   │   ├── index.html                  # Dashboard (main)
│   │   ├── inventory.html              # Product/inventory management
│   │   ├── login.html                  # Login page
│   │   ├── profile.html                # Business profile settings
│   │   ├── reports.html                # Reports & analytics
│   │   ├── reset-password.html         # Password reset
│   │   └── signup.html                 # Registration page
│   │
│   ├── scripts/
│   │   ├── auth.js                     # Authentication logic
│   │   ├── billing.js                  # Invoice creation & PDF
│   │   ├── config.js                   # Configuration settings
│   │   ├── customers.js                # Customer management
│   │   ├── customer-ledger.js          # Customer ledger functionality
│   │   ├── dark-mode.js                # Dark/light theme toggle
│   │   ├── dashboard.js                # Dashboard functionality
│   │   ├── dashboard-modern.js         # Modern dashboard logic
│   │   ├── dialog.js                   # Custom confirmation dialogs
│   │   ├── expenses.js                 # Expense management
│   │   ├── inventory.js                # Inventory management
│   │   ├── notifications.js            # Notification system
│   │   ├── supabase.js                 # Supabase database integration
│   │   ├── toast.js                    # Toast notification system
│   │   └── validation.js               # Form validation utilities
│   │
│   ├── styles/
│   │   ├── dark-mode.css               # Dark theme variables
│   │   ├── styles.css                  # Main stylesheet
│   │   └── styles-new.css              # Modern component styles
│   │
│   └── assets/                         # Images, icons, etc.
│
├── database/
│   ├── add-invoice-date-column.sql      # Database migration
│   └── update-profile-schema.sql        # Database schema updates
│
├── docs/
│   ├── BACKUP_IMPLEMENTATION.md         # Backup feature docs
│   ├── DARK_MODE_IMPLEMENTATION.md      # Dark mode docs
│   ├── ERROR_HANDLING_IMPLEMENTATION.md # Error handling docs
│   ├── FUTURE_MULTI_LANGUAGE.md         # Multi-language planning
│   ├── futureproof.md                   # Futureproofing docs
│   ├── implementation.md                # Full implementation guide
│   ├── PROFILE_UPDATE_README.md         # Profile update docs
│   ├── README.md                        # This file
│   ├── SUPABASE_SETUP.md                # Database setup guide
│   └── TESTING_BACKUP.md                # Backup testing guide
│
├── index.html                           # GitHub pages entry point
├── 404.html                             # GitHub pages 404 handler
├── _config.yml                          # GitHub pages config
└── .gitignore                           # Git ignore rules
```

## Invoice Number Format
Invoices are automatically numbered in the format: `K####/MM/YY`
- K0001/02/26 (First invoice in February 2026)
- K0002/02/26 (Second invoice)
- etc.

## Customization

### Changing Company Details
Edit the company information in `billing.js` at line ~86:
```javascript
pdf.text('Company Name', 15, y);
pdf.text('Indra Auto Nagar, Rangeen Masjid Road Bijapur', 15, y);
// etc.
```

### Default GST Rate
Change the default GST rate in `create-bill.html` at line 42:
```html
<input type="number" id="gstRate" value="18" ...>
```

### Terms & Conditions
Default terms can be edited in `create-bill.html` at line 90-96

## Browser Compatibility
- Chrome (recommended)
- Firefox
- Edge
- Safari
- Any modern browser with localStorage support

## Notes
- All data is stored locally in your browser
- **Create regular backups** using the Backup button to prevent data loss
- Clearing browser data will delete all invoices (unless backed up)
- PDF generation works offline (no internet required after initial load)
- Use backup files to transfer data between computers

## Security & Privacy
- All data stays on your computer (no cloud/server)
- No login required for single-user setup
- Backup files contain all your business data - keep them secure
- No tracking or data collection

## 🎯 Recently Implemented (March 2026)

### Customer Database Management
- Save and manage customer profiles with complete information
- Quick-select dropdown in billing form for faster invoicing
- Edit/delete customer records with confirmation dialogs
- Customer payment history and analytics

### Expense Management System
- Track business expenses with multiple categories
- Visual analytics with charts showing spending trends
- Categorize and filter expenses efficiently
- Export expense reports for accounting

### Customer Ledger / Payment History
- View complete transaction history per customer
- Interactive charts showing monthly spending patterns
- Calculate customer analytics (total spent, avg order, last purchase)
- CSV export for each customer's ledger

## 🔄 How to Use the New Features

### Adding a Customer
1. Click "Customers" in the sidebar
2. Click "Add Customer" button
3. Fill in customer details (name, mobile, email, address, GST)
4. Click "Save Customer"

### Viewing Customer Ledger
1. Go to Customers page
2. Click "Ledger" button on any customer row
3. View their complete payment history
4. See spending trends and statistics
5. Click "Export CSV" to download their transaction history

### Adding Expenses
1. Click "Expenses" in the sidebar
2. Click "Add Expense" button
3. Fill in expense details (amount, category, date, notes)
4. Click "Save Expense"
5. View monthly trends in charts
6. Filter by category or date range

## 📊 Features Comparison

| Feature | Status | Location |
|---------|--------|----------|
| Dashboard | ✅ Live | index.html |
| Create Invoices | ✅ Live | create-bill.html |
| Inventory | ✅ Live | inventory.html |
| Customers | ✅ Live | customers.html |
| Customer Ledger | ✅ Live | customer-ledger.html |
| Expenses | ✅ Live | expenses.html |
| Data Backup | ✅ Live | All pages |
| Dark Mode | ✅ Live | All pages |
| Reports | 🔄 In Progress | reports.html |
| Payment Tracking | 🔜 Planned | - |
| Advanced Analytics | 🔜 Planned | - |

## Future Enhancements
- ✅ ~~Data Backup & Restore~~ (Completed Feb 9)
- ✅ ~~Customer Database~~ (Completed Feb 28)
- ✅ ~~Expense Management~~ (Completed Mar 1)
- ✅ ~~Customer Ledger~~ (Completed Mar 1)
- 🔜 Payment status tracking
- 🔜 Enhanced search & filter
- 🔜 Advanced reporting & analytics
- 🔜 Multi-user support with authentication
