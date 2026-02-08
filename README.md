# KounterPro- Billing Software

A simple, plain UI billing/invoicing software for managing sales and generating PDF invoices.

## Features

### Dashboard (index.html)
- **Sales Overview**: View today's sales, total units sold, and all-time sales
- **Sales Filtering**: Filter invoices by date range to view historical data
- **Invoice Management**: View and delete invoices from the list
- **Quick Access**: Create new bills with a single click

### Create Invoice (create-bill.html)
- **Customer Details**: Name, address, and optional GST number
- **Dynamic Item Table**: Add/remove items with automatic calculations
- **Customizable GST**: Adjust GST rate (default 18%)
- **Auto-calculation**: Real-time calculation of subtotal, GST, and grand total
- **PDF Generation**: Download professional tax invoices in PDF format
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

## Technical Details

### Technologies Used
- HTML5, CSS3, JavaScript (Vanilla - no frameworks)
- jsPDF library for PDF generation
- localStorage for data persistence

### Data Storage
- All invoices are stored in browser's localStorage
- Data persists across browser sessions
- No backend or database required

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
- Clear browser data will delete all invoices
- For production use, consider adding a backend database
- PDF generation works offline (no internet required after initial load)

## Future Enhancements (Optional)
- Export data to Excel/CSV
- Email invoice functionality
- Multi-user support with backend
- Inventory management
- Payment tracking
- Customer database
