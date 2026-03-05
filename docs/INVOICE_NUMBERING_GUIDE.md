# Invoice Numbering Customization Guide

## Overview

The invoice numbering system now supports customizable prefixes and manual editing, allowing businesses to maintain their own invoice numbering conventions while preventing duplicate invoice numbers.

## Features Implemented

### 1. Custom Invoice Prefix
- Users can define a custom prefix for their invoices (e.g., `INV`, `SHOP`, `BILL`, `2026-INV`)
- Prefix supports uppercase letters, numbers, hyphens, underscores, and forward slashes
- Maximum 20 characters
- Default: `INV` if no prefix is set

### 2. Starting Invoice Number
- Users can set a custom starting number (1-999999)
- Useful for migrating from other systems or continuing an existing sequence
- Default: 1

### 3. Auto-Increment
- System automatically increments invoice numbers
- Counter tracked per user in the database
- Format: `PREFIX-0001`, `PREFIX-0002`, etc.

### 4. Manual Invoice Number Editing
- Users can manually edit invoice numbers when creating invoices
- Click "Edit" button next to invoice number field
- Duplicate validation prevents conflicts

### 5. Duplicate Prevention
- System checks for duplicate invoice numbers before saving
- Real-time validation with error messages
- Cannot create invoice with existing invoice number

## Database Schema

### New Columns in `user_profiles` Table

```sql
- invoice_prefix (VARCHAR(20))
  - Custom prefix for invoice numbers
  - Constraint: ^[A-Z0-9\-\_\/]+$ (uppercase alphanumeric with -, _, /)
  - Default: 'INV'

- starting_invoice_number (INTEGER)
  - Starting number for invoice sequence
  - Constraint: 1-999999
  - Default: 1

- current_invoice_counter (INTEGER)
  - Current counter for auto-increment
  - Incremented after each invoice
  - Default: 0
```

### Database Functions

**`get_next_invoice_number(user_uuid UUID)`**
- Returns the next invoice number for a user
- Format: `PREFIX-XXXX` (4-digit padded)
- Automatically increments counter

**`validate_invoice_number_unique(invoice_num TEXT, user_uuid UUID, invoice_id_to_exclude UUID)`**
- Validates that an invoice number is unique
- Returns boolean (true if unique, false if duplicate)
- Excludes specific invoice ID (useful for editing)

## Setup Instructions

### Step 1: Run Database Migration

1. Open Supabase SQL Editor
2. Run the migration script: `database/invoice-numbering-customization.sql`
3. Verify success message: "Invoice numbering customization migration completed successfully!"

### Step 2: Configure Invoice Prefix (Optional)

1. Navigate to **Business Profile → Profile Settings**
2. Scroll to **Invoice Settings** section
3. Enter your desired **Invoice Number Prefix** (e.g., `INV`, `SHOP`, `BILL`)
4. Set **Starting Invoice Number** (e.g., 1, 100, 1001)
5. View real-time preview of next invoice number
6. Click **Save Profile**

### Step 3: Create Invoices with Custom Numbering

1. Navigate to **Create Invoice**
2. Invoice number auto-generated based on your settings
3. To manually edit:
   - Click "Edit" button next to invoice number
   - Modify as needed
   - Click "Save" to validate
4. System prevents duplicate invoice numbers

## Usage Examples

### Example 1: Simple Prefix
```
Prefix: INV
Starting Number: 1
Counter: 0

Generated Invoice Numbers:
INV-0001
INV-0002
INV-0003
```

### Example 2: Shop Prefix with Higher Starting Number
```
Prefix: SHOP
Starting Number: 1001
Counter: 0

Generated Invoice Numbers:
SHOP-1001
SHOP-1002
SHOP-1003
```

### Example 3: Date-Based Prefix
```
Prefix: 2026-03-INV
Starting Number: 1
Counter: 0

Generated Invoice Numbers:
2026-03-INV-0001
2026-03-INV-0002
2026-03-INV-0003
```

### Example 4: Manual Override
```
Auto-generated: INV-0015
Manual override: INV-SPECIAL-001
System validates: ✅ Unique - Allowed
```

## Validation Rules

### Invoice Prefix
- ✅ Uppercase letters (A-Z)
- ✅ Numbers (0-9)
- ✅ Hyphens (-)
- ✅ Underscores (_)
- ✅ Forward slashes (/)
- ❌ Lowercase letters (auto-converted to uppercase)
- ❌ Special characters (!, @, #, etc.)
- ❌ Spaces

### Starting Invoice Number
- ✅ Range: 1 to 999,999
- ❌ Zero or negative numbers
- ❌ Numbers > 999,999

### Invoice Number Field
- ✅ Auto-generated based on prefix + counter
- ✅ Manually editable with Edit button
- ✅ Duplicate validation before saving
- ❌ Cannot be empty
- ❌ Cannot duplicate existing invoice number

## Legacy Format Support

The system maintains backward compatibility with the legacy invoice format:

**Legacy Format:** `K0001/3/25/26` (K + number / month / FY start / FY end)

- If no custom prefix is set, the system continues to use the legacy format
- Existing invoices remain unchanged
- Financial year logic preserved for legacy invoices

## Migration from Other Systems

To migrate from another system with existing invoice numbers:

1. **Determine your highest invoice number**
   - Example: Last invoice was `INV-0150`

2. **Set starting number to next number**
   - Starting Invoice Number: 151

3. **Set your prefix**
   - Invoice Prefix: INV

4. **Result**: Next invoice will be `INV-0151`

## API Reference

### JavaScript Functions

**`generateInvoiceNumber()`**
- Generates next invoice number based on user settings
- Returns: String (e.g., `INV-0001` or `K0001/3/25/26`)
- Auto-detects custom prefix vs. legacy format

**`incrementInvoiceCounter()`**
- Increments user's invoice counter after successful invoice creation
- Only increments for custom prefix users
- Called automatically after invoice save

**`validateInvoiceNumber()`**
- Validates invoice number for duplicates
- Returns: Boolean (true if valid, false if duplicate)
- Shows error message if duplicate found

**`updateInvoiceNumberPreview()`**
- Updates real-time preview in profile settings
- Shows next invoice number based on current settings
- Calculates: prefix + starting number + counter

## Troubleshooting

### Issue: Invoice number not auto-generating
**Solution**: Refresh the page or check browser console for errors

### Issue: Duplicate invoice number error
**Solution**: 
- Click "Edit" to manually change invoice number
- System will validate uniqueness before allowing save

### Issue: Prefix not saving
**Solution**:
- Ensure prefix follows validation rules (uppercase alphanumeric with -, _, /)
- Check that prefix is ≤ 20 characters

### Issue: Counter not incrementing
**Solution**:
- Verify invoice was successfully created
- Check database: `SELECT current_invoice_counter FROM user_profiles WHERE id = 'your-user-id'`
- Counter only increments for custom prefix users (not legacy format)

## Best Practices

1. **Choose a meaningful prefix**
   - Use business name initials or invoice type
   - Keep it short and memorable

2. **Set starting number early**
   - Easier to set before creating any invoices
   - Can still change later, but existing invoices remain unchanged

3. **Use consistent format**
   - Stick with one prefix format
   - Avoid frequent changes to maintain continuity

4. **Manual editing**
   - Use sparingly for special cases
   - Always validate for duplicates

5. **Financial year tracking**
   - Consider including year in prefix (e.g., `2026-INV`)
   - Update prefix at start of each financial year

## Security Considerations

- Invoice numbers are user-scoped (cannot conflict with other users)
- Database functions use `SECURITY DEFINER` for proper access control
- Duplicate validation prevents accidental overwrites
- All validations enforced at database level with check constraints

## Future Enhancements

Potential future improvements:
- Automatic date-based prefix updates
- Separate invoice sequences per financial year
- Invoice number templates with variables
- Bulk invoice number reassignment tool
- Invoice number format validation presets

---

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify database migration completed successfully
3. Test with default settings first
4. Review validation rules above

**Happy Invoicing! 📋✨**
