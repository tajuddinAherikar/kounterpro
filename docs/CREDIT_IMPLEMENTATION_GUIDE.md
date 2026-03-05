# Credit Purchase Implementation Guide

## Overview
This guide explains the complete implementation of credit purchase support in KounterPro.

## Database Schema Updates

### 1. Update `invoices` table
Run these SQL commands in your Supabase SQL Editor:

```sql
-- Add new columns to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'cash' CHECK (payment_type IN ('cash', 'credit')),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_due NUMERIC(10,2) DEFAULT 0;

-- Create index for faster customer invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
```

### 2. Update `customers` table
```sql
-- Add outstanding balance column
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(10,2) DEFAULT 0;

-- Create index for customers with outstanding balances
CREATE INDEX IF NOT EXISTS idx_customers_outstanding ON customers(outstanding_balance) WHERE outstanding_balance > 0;
```

### 3. Create `payments` table
```sql
-- Create payments table for tracking payment history
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);

-- Enable Row Level Security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own payments"
    ON payments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
    ON payments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payments"
    ON payments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payments"
    ON payments FOR DELETE
    USING (auth.uid() = user_id);
```

### 4. Create function to update customer balance (Optional - for data integrity)
```sql
-- Function to automatically update customer outstanding balance
-- Handles INSERT, UPDATE, and DELETE operations
CREATE OR REPLACE FUNCTION update_customer_balance()
RETURNS TRIGGER AS $$
DECLARE
    target_customer_id UUID;
BEGIN
    -- Get the customer_id based on operation type
    IF (TG_OP = 'DELETE') THEN
        target_customer_id := OLD.customer_id;
    ELSE
        target_customer_id := NEW.customer_id;
    END IF;
    
    -- Skip if no customer_id (for invoices without linked customers)
    IF target_customer_id IS NULL THEN
        IF (TG_OP = 'DELETE') THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;
    
    -- Recalculate customer's outstanding balance from all their unpaid/partial invoices
    UPDATE customers
    SET outstanding_balance = (
        SELECT COALESCE(SUM(amount_due), 0)
        FROM invoices
        WHERE customer_id = target_customer_id
        AND payment_status IN ('unpaid', 'partial')
    )
    WHERE id = target_customer_id;
    
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update balance when invoice changes
-- Note: You'll see a warning about DROP TRIGGER - this is normal and safe
DROP TRIGGER IF EXISTS trigger_update_customer_balance ON invoices;
CREATE TRIGGER trigger_update_customer_balance
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_balance();
```

**⚠️ Important Note about the Warning:**
When you run the `DROP TRIGGER` command, Supabase will show a warning about a "destructive operation". This is expected and safe to proceed:
- The `IF EXISTS` clause means it won't fail if the trigger doesn't exist yet
- You need to drop the old trigger (if any) before creating the new one
- Click **"Run this query"** to confirm and execute

The trigger will then automatically keep customer balances in sync whenever invoices are created, updated, or deleted.

## Features Implemented

### 1. Payment Type Selection
- Radio buttons for Cash/Credit on invoice creation
- Default: Cash
- When Credit selected, shows customer's current outstanding balance

### 2. Partial Payment Support
- Optional "Partial Payment" checkbox for credit invoices
- Enter amount paid (validates against total amount)
- Automatically calculates remaining due amount

### 3. Customer Balance Display
- Shows current outstanding balance when customer is selected
- Updates in real-time as invoice is being created
- Color-coded warnings for high outstanding balances

### 4. Payment Recording
- New "Record Payment" button on customer ledger
- Modal to enter payment details:
  - Amount
  - Payment date
  - Payment method
  - Notes
- Automatically updates invoice status and customer balance

### 5. Credit Reports
- Filter invoices by payment status (All, Paid, Unpaid, Partial)
- Sort by outstanding amount
- Export credit report to PDF/Excel

### 6. Customer Ledger Enhancements
- Payment history with dates and amounts
- Outstanding balance prominently displayed
- Quick payment recording from ledger

## UI Changes Summary

### create-bill.html
- Payment Type selector (Cash/Credit)
- Customer outstanding balance display
- Partial payment section
- Visual feedback for credit transactions

### customer-ledger.html
- Outstanding balance at top
- Payment history table
- "Record Payment" button
- Payment modal

### Dashboard
- Outstanding payments summary card
- Top customers with pending payments
- Quick links to credit management

## Testing Checklist

After running the SQL commands:

1. ✅ Create a cash invoice - should work as before
2. ✅ Create a credit invoice - customer balance should increase
3. ✅ Create a partial payment invoice - balance should update correctly
4. ✅ Record a payment - balance should decrease
5. ✅ View customer ledger - should show all transactions
6. ✅ Check dashboard - should show outstanding amounts
7. ✅ Test with existing customers - backward compatibility
8. ✅ Test with new customers - full credit flow

## Migration Notes

- Existing invoices will default to 'cash' payment type and 'paid' status
- Existing customers will have 0 outstanding balance initially
- No data loss - all changes are additive
- Backward compatible with existing code

## Next Steps

1. Run SQL commands in Supabase (copy from sections above)
2. Refresh your app to load new UI components
3. Test credit invoice creation
4. Verify customer balance updates
5. Test payment recording
6. Review reports and ledger

## Support

If you encounter any issues:
- Check browser console for errors
- Verify SQL commands executed successfully in Supabase
- Ensure RLS policies are active
- Check that indexes were created
