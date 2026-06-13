export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

export function formatDateInput(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getDaysOverdue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function getRiskCategory(
  daysOverdue: number,
  outstandingAmount: number,
  overdueInvoiceCount: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (daysOverdue > 30 || outstandingAmount > 500000 || overdueInvoiceCount >= 4) return 'critical';
  if (daysOverdue > 15 || outstandingAmount > 200000 || overdueInvoiceCount >= 3) return 'high';
  if (daysOverdue > 7 || outstandingAmount > 100000 || overdueInvoiceCount >= 2) return 'medium';
  return 'low';
}

export function generateInvoiceNumber(count: number): string {
  const pad = String(count + 1).padStart(4, '0');
  const year = new Date().getFullYear().toString().slice(-2);
  return `INV-${year}-${pad}`;
}

export function generateOrderNumber(count: number): string {
  const pad = String(count + 1).padStart(4, '0');
  const year = new Date().getFullYear().toString().slice(-2);
  return `ORD-${year}-${pad}`;
}

export function getReminderMessage(
  type: string,
  invoiceNumber: string,
  dueDate: string,
  amount: number
): string {
  const formattedDate = formatDate(dueDate);
  const formattedAmount = formatCurrency(amount);
  switch (type) {
    case '7_days_before':
      return `Dear Customer, your payment of ${formattedAmount} for Invoice #${invoiceNumber} is due on ${formattedDate}. Please arrange payment. - TextileFlow`;
    case '1_day_before':
      return `Friendly reminder: Payment of ${formattedAmount} for Invoice #${invoiceNumber} is due tomorrow (${formattedDate}). Kindly arrange payment. - TextileFlow`;
    case 'due_date':
      return `Payment of ${formattedAmount} for Invoice #${invoiceNumber} is due TODAY. Please make the payment at your earliest convenience. - TextileFlow`;
    case '3_days_overdue':
      return `Your payment of ${formattedAmount} for Invoice #${invoiceNumber} (due ${formattedDate}) is pending. Kindly arrange payment immediately. - TextileFlow`;
    case '10_days_overdue':
      return `URGENT: Payment of ${formattedAmount} for Invoice #${invoiceNumber} is 10 days overdue. Please contact us immediately to resolve this. - TextileFlow`;
    default:
      return '';
  }
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function validateMobile(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
}

export function sanitizeMobile(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  // Remove leading 0
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  // Remove leading 91 (country code)
  if (cleaned.startsWith('91')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

export function openWhatsAppReminder(phone: string, message: string): boolean {
  try {
    let mobile = phone;
    // Strip +91 or 91
    if (mobile.startsWith('+91')) {
      mobile = mobile.substring(3);
    } else if (mobile.startsWith('91')) {
      mobile = mobile.substring(2);
    }

    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/91${mobile}?text=${encodedMessage}`;

    // Try window.open first
    const result = window.open(url, '_blank');
    if (result) {
      return true;
    }

    // Fallback to window.location.href
    window.location.href = url;
    return true;
  } catch {
    return false;
  }
}

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  gst?: number;
}

interface Invoice {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  gstAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalAmount: number;
  outstandingBalance: number;
  notes?: string;
}

interface Customer {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
}

interface CompanyBranding {
  name?: string;
  address?: string;
  gstNumber?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  footerText?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export function generateInvoiceHTML(
  invoice: Invoice,
  customer: Customer,
  items: InvoiceItem[],
  branding?: CompanyBranding
): string {
  const companyName = branding?.name || 'TextileFlow';
  const companyAddress = branding?.address || 'Textile Market, Ring Road, Surat, Gujarat 395002';
  const gstNumber = branding?.gstNumber || '24AABCT0000F1Z5';
  const phone = branding?.phone || '0261-2345678';
  const email = branding?.email || 'billing@textileflow.in';
  const bankName = branding?.bankName || 'SBI';
  const bankAccount = branding?.bankAccount || '3824567890';
  const bankIfsc = branding?.bankIfsc || 'SBIN0001234';
  const footerText = branding?.footerText || 'Thank you for your business!';
  const logoUrl = branding?.logoUrl;
  const primaryColor = branding?.primaryColor || '#0d9488';

  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:8px;" />`
    : '';
  const nameHTML = logoUrl
    ? `<p style="font-size:18px;font-weight:700;color:${primaryColor};margin-bottom:4px;">${companyName}</p>`
    : `<h1 style="font-size:28px;color:${primaryColor};margin-bottom:8px;">${companyName}</h1>`;

  const itemsHTML = items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left; font-size: 13px;">${item.description}</td>
      <td style="padding: 12px; text-align: center; font-size: 13px;">${item.quantity}</td>
      <td style="padding: 12px; text-align: right; font-size: 13px;">₹${item.rate.toLocaleString('en-IN')}</td>
      <td style="padding: 12px; text-align: right; font-size: 13px;">₹${item.amount.toLocaleString('en-IN')}</td>
    </tr>
  `
    )
    .join('');

  const subtotal = invoice.amount;

  // Build GST breakdown
  let gstBreakdownHTML = '';
  if (invoice.cgstAmount && invoice.cgstAmount > 0 && invoice.sgstAmount && invoice.sgstAmount > 0) {
    // CGST/SGST breakdown
    const cgstRate = Math.round((invoice.cgstAmount / subtotal) * 100);
    const sgstRate = Math.round((invoice.sgstAmount / subtotal) * 100);
    gstBreakdownHTML = `
        <div class="summary-row gst">
          <span>CGST (${cgstRate}%):</span>
          <span>₹${invoice.cgstAmount.toLocaleString('en-IN')}</span>
        </div>
        <div class="summary-row gst">
          <span>SGST (${sgstRate}%):</span>
          <span>₹${invoice.sgstAmount.toLocaleString('en-IN')}</span>
        </div>
    `;
  } else if (invoice.igstAmount && invoice.igstAmount > 0) {
    // IGST breakdown
    const igstRate = Math.round((invoice.igstAmount / subtotal) * 100);
    gstBreakdownHTML = `
        <div class="summary-row gst">
          <span>IGST (${igstRate}%):</span>
          <span>₹${invoice.igstAmount.toLocaleString('en-IN')}</span>
        </div>
    `;
  } else if (invoice.gstAmount && invoice.gstAmount > 0) {
    // Fallback to generic GST
    const gstRate = Math.round((invoice.gstAmount / subtotal) * 100);
    gstBreakdownHTML = `
        <div class="summary-row gst">
          <span>GST (${gstRate}%):</span>
          <span>₹${invoice.gstAmount.toLocaleString('en-IN')}</span>
        </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px; background: white; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid ${primaryColor}; padding-bottom: 20px; }
    .company-details { font-size: 12px; color: #666; line-height: 1.8; }
    .company-details p { margin: 4px 0; }
    .invoice-info { text-align: right; }
    .invoice-info h2 { font-size: 24px; color: #1f2937; margin-bottom: 12px; }
    .invoice-info p { font-size: 13px; margin: 6px 0; }
    .invoice-info .label { color: #666; font-weight: 600; }
    .customer-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
    .customer-box h3 { font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .customer-box p { font-size: 13px; margin: 6px 0; color: #333; }
    .items-table { width: 100%; margin-bottom: 30px; border-collapse: collapse; }
    .items-table thead { background: ${primaryColor}; color: white; }
    .items-table th { padding: 12px; text-align: left; font-size: 13px; font-weight: 600; }
    .items-table th:nth-child(2),
    .items-table th:nth-child(3),
    .items-table th:nth-child(4) { text-align: right; }
    .items-table td { padding: 12px; font-size: 13px; }
    .items-table td:nth-child(2),
    .items-table td:nth-child(3),
    .items-table td:nth-child(4) { text-align: right; }
    .summary-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
    .summary-box { width: 100%; max-width: 400px; }
    .summary-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
    .summary-row.gst { color: #666; }
    .summary-row.total { font-size: 16px; font-weight: 700; color: ${primaryColor}; border-bottom: 2px solid ${primaryColor}; padding: 12px 0; margin-top: 8px; }
    .summary-row.outstanding { font-size: 15px; font-weight: 600; color: #dc2626; border: none; padding: 12px 0; }
    .notes-section { margin-bottom: 40px; padding: 15px; background: #f3f4f6; border-left: 4px solid ${primaryColor}; border-radius: 4px; }
    .notes-section h4 { font-size: 13px; font-weight: 700; color: #1f2937; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .notes-section p { font-size: 12px; color: #666; }
    .footer { text-align: center; padding-top: 30px; border-top: 2px solid #e5e7eb; }
    .footer-thank-you { font-size: 14px; font-weight: 600; color: ${primaryColor}; margin-bottom: 15px; }
    .footer-bank { font-size: 12px; color: #666; line-height: 1.8; }
    .footer-bank p { margin: 4px 0; }
    @media print {
      body { margin: 0; padding: 0; }
      .container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        ${logoHTML}
        ${nameHTML}
        <div class="company-details">
          <p>${companyAddress}</p>
          <p>GST: ${gstNumber}</p>
          <p>Phone: ${phone}</p>
          <p>Email: ${email}</p>
        </div>
      </div>
      <div class="invoice-info">
        <h2>INVOICE</h2>
        <p><span class="label">Invoice Number:</span> ${invoice.invoiceNumber}</p>
        <p><span class="label">Invoice Date:</span> ${formatDate(invoice.invoiceDate)}</p>
        <p><span class="label">Due Date:</span> ${formatDate(invoice.dueDate)}</p>
      </div>
    </div>

    <div class="customer-section">
      <div class="customer-box">
        <h3>Bill To</h3>
        <p>${customer.name}</p>
        ${customer.address ? `<p>${customer.address}</p>` : ''}
        ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ''}
        ${customer.email ? `<p>Email: ${customer.email}</p>` : ''}
        ${customer.gstNumber ? `<p>GST: ${customer.gstNumber}</p>` : ''}
      </div>
      <div class="customer-box">
        <h3>Ship To</h3>
        <p>${customer.name}</p>
        ${customer.address ? `<p>${customer.address}</p>` : ''}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Quantity</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div class="summary-section">
      <div class="summary-box">
        <div class="summary-row">
          <span>Subtotal:</span>
          <span>₹${subtotal.toLocaleString('en-IN')}</span>
        </div>
        ${gstBreakdownHTML}
        <div class="summary-row total">
          <span>Total Amount:</span>
          <span>₹${invoice.totalAmount.toLocaleString('en-IN')}</span>
        </div>
        <div class="summary-row outstanding">
          <span>Outstanding Balance:</span>
          <span>₹${invoice.outstandingBalance.toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>

    ${
      invoice.notes
        ? `
    <div class="notes-section">
      <h4>Notes</h4>
      <p>${invoice.notes}</p>
    </div>
    `
        : ''
    }

    <div class="footer">
      <div class="footer-thank-you">${footerText}</div>
      <div class="footer-bank">
        <p><strong>Bank Details:</strong></p>
        <p>Bank: ${bankName}</p>
        <p>Account Number: ${bankAccount}</p>
        <p>IFSC Code: ${bankIfsc}</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
