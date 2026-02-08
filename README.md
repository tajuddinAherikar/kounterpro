# KounterPro- Billing Software

A simple, plain UI billing/invoicing software for managing sales and generating PDF invoices.

## Features

### Dashboard (index.html)
- **Sales Overview**: View today's sales, total units sold, and all-time sales
- **Sales Filtering**: Filter invoices by date range to view historical data
- **Invoice Management**: View and delete invoices from the list
- **Quick Access**: Create new bills with a single click
- **Data Backup**: Export all data to JSON file for safekeeping
- **Data Restore**: Import backup files to restore data

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

## Files Structure
```
keen/
├── index.html          # Dashboard page
├── create-bill.html    # Invoice creation page
├── styles.css          # Styling for all pages
├── dashboard.js        # Dashboard functionality
├── billing.js          # Invoice creation and PDF generation
└── README.md          # This file
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

## Future Enhancements
- ✅ ~~Data Backup & Restore~~ (Completed)
- 🔜 Customer database (next priority)
- 🔜 Payment status tracking
- 🔜 Low stock alerts
- Enhanced search & filter
- Advanced reporting & analytics
- Multi-user support with authentication
