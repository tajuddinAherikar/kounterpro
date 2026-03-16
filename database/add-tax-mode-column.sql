-- Add tax_mode column to invoices table
-- This stores whether the invoice is created with tax (GST) or without tax

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS tax_mode VARCHAR(15) DEFAULT 'with-tax';

-- Add comment for documentation
COMMENT ON COLUMN invoices.tax_mode IS 'Invoice tax mode: with-tax or without-tax';

-- Update existing records to have tax_mode
UPDATE invoices SET tax_mode = 'with-tax' WHERE tax_mode IS NULL;
