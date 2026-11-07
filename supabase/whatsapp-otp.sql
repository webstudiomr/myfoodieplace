-- Run this once in Supabase SQL Editor before using WhatsApp OTP tracking.
CREATE TABLE IF NOT EXISTS public.order_tracking_otps (
  id UUID PRIMARY KEY,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','sent','verified')),
  otp_hash TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS order_tracking_otps_phone_created_idx
ON public.order_tracking_otps (phone, created_at DESC);
ALTER TABLE public.order_tracking_otps ENABLE ROW LEVEL SECURITY;
