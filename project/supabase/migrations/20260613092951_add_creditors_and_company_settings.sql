-- Creditors table (suppliers we owe money to)
CREATE TABLE creditors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text NOT NULL,
  whatsapp text,
  gst_number text,
  address text,
  credit_period integer DEFAULT 30,
  outstanding_balance numeric DEFAULT 0,
  category text DEFAULT 'supplier' CHECK (category IN ('supplier', 'vendor', 'service_provider', 'other')),
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE creditors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_creditors" ON creditors FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_creditors" ON creditors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_own_creditors" ON creditors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_creditors" ON creditors FOR DELETE TO authenticated USING (true);

-- Creditor payments table (payments made to creditors)
CREATE TABLE creditor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creditor_id uuid NOT NULL REFERENCES creditors(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'upi')),
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE creditor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_creditor_payments" ON creditor_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_creditor_payments" ON creditor_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_own_creditor_payments" ON creditor_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_creditor_payments" ON creditor_payments FOR DELETE TO authenticated USING (true);

-- Company settings table (branding, logo, theme)
CREATE TABLE company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text DEFAULT 'TextileFlow',
  company_address text DEFAULT 'Textile Market, Ring Road, Surat, Gujarat 395002',
  company_gst_number text DEFAULT '24AABCT0000F1Z5',
  company_phone text DEFAULT '0261-2345678',
  company_email text DEFAULT 'billing@textileflow.in',
  company_website text,
  bank_name text DEFAULT 'SBI',
  bank_account text DEFAULT '3824567890',
  bank_ifsc text DEFAULT 'SBIN0001234',
  logo_url text,
  primary_color text DEFAULT '#0d9488',
  invoice_footer text DEFAULT 'Thank you for your business!',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_company_settings" ON company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_company_settings" ON company_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_own_company_settings" ON company_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_company_settings" ON company_settings FOR DELETE TO authenticated USING (true);

-- Insert default company settings
INSERT INTO company_settings (company_name) VALUES ('TextileFlow');

-- Add GST type columns to invoice_items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS gst_type text DEFAULT 'igst' CHECK (gst_type IN ('cgst_sgst', 'igst'));

-- Add CGST/SGST/IGST breakdown columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_amount numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_amount numeric DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_amount numeric DEFAULT 0;