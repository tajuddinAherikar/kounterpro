-- Add barcode column to inventory table
-- This stores product barcode/SKU information for quick product lookup

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

-- Add index on barcode for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_user_barcode ON inventory(user_id, barcode) WHERE barcode IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN inventory.barcode IS 'Product barcode/SKU (UPC, EAN, QR code, custom SKU, etc.)';
