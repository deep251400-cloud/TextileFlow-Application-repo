export interface Customer {
  id: string;
  name: string;
  mobile: string;
  whatsapp: string | null;
  gst_number: string | null;
  address: string | null;
  credit_period: number;
  credit_limit: number;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_name: string;
  quality: string | null;
  quantity: number;
  unit: string;
  rate: number;
  gst_percentage: number;
  gst_type: 'cgst_sgst' | 'igst';
  amount: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_id: string;
  subtotal: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'partial';
  notes: string | null;
  created_at: string;
  customer?: Customer;
  items?: InvoiceItem[];
}

export interface Payment {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'cheque' | 'upi';
  notes: string | null;
  created_at: string;
  invoice?: Invoice;
  customer?: Customer;
}

export interface Creditor {
  id: string;
  name: string;
  mobile: string;
  whatsapp: string | null;
  gst_number: string | null;
  address: string | null;
  credit_period: number;
  outstanding_balance: number;
  category: 'supplier' | 'vendor' | 'service_provider' | 'other';
  notes: string | null;
  created_at: string;
}

export interface CreditorPayment {
  id: string;
  creditor_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'bank_transfer' | 'cheque' | 'upi';
  notes: string | null;
  created_at: string;
  creditor?: Creditor;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  company_address: string;
  company_gst_number: string;
  company_phone: string;
  company_email: string;
  company_website: string | null;
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
  logo_url: string | null;
  primary_color: string;
  invoice_footer: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  mill_name: string;
  product_name: string;
  quantity: number;
  unit: string;
  order_date: string;
  expected_delivery_date: string;
  actual_delivery_date: string | null;
  customer_id: string | null;
  status: 'ordered' | 'production_started' | 'in_process' | 'ready' | 'dispatched' | 'delivered' | 'delayed';
  notes: string | null;
  created_at: string;
  customer?: Customer | null;
}

export interface Expense {
  id: string;
  expense_type: 'salary' | 'supplier' | 'transport' | 'rent' | 'utility' | 'other';
  description: string;
  amount: number;
  due_date: string;
  is_paid: boolean;
  paid_date: string | null;
  is_recurring: boolean;
  created_at: string;
}

export interface Reminder {
  id: string;
  invoice_id: string;
  customer_id: string;
  reminder_type: '7_days_before' | '1_day_before' | 'due_date' | '3_days_overdue' | '10_days_overdue';
  scheduled_date: string;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed';
  message: string | null;
  created_at: string;
  invoice?: Invoice;
  customer?: Customer;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type Page =
  | 'dashboard'
  | 'customers'
  | 'invoices'
  | 'orders'
  | 'debtors'
  | 'creditors'
  | 'cashflow'
  | 'reminders'
  | 'reports'
  | 'notifications'
  | 'settings';
