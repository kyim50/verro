-- Add PayPal-related columns to payment_transactions table
-- This migration adds the missing columns needed for PayPal payment processing

-- Add paypal_order_id column (stores PayPal order ID)
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

-- Add paypal_capture_id column (stores PayPal capture ID after payment is captured)
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;

-- Add paypal_payout_id column (stores PayPal payout ID when funds are transferred to artist)
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS paypal_payout_id TEXT;

-- Add custom_id column (stores JSON metadata for the transaction)
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS custom_id TEXT;

-- Add processed_at timestamp (when the payment was processed)
ALTER TABLE payment_transactions 
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_transactions_paypal_order_id 
ON payment_transactions(paypal_order_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_paypal_capture_id 
ON payment_transactions(paypal_capture_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_commission_id 
ON payment_transactions(commission_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status 
ON payment_transactions(status);

