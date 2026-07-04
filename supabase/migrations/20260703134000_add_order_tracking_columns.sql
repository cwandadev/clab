-- Add missing columns to orders table for tracking and checkout options

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS anonymous BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pickup_option BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS carrier TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);