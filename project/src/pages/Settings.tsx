import React, { useState, useRef } from 'react';
import { Building2, Palette, Landmark, FileText, Save, Check, Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompanySettings } from '../lib/companySettings';
import type { CompanySettings } from '../types';

const COLOR_PRESETS = [
  { name: 'Teal', value: '#0d9488' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Slate', value: '#475569' },
];

type Tab = 'company' | 'branding' | 'bank' | 'invoice';

export default function Settings() {
  const { settings, loading, update, refresh } = useCompanySettings();
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const [form, setForm] = useState({
    company_name: settings.company_name,
    company_address: settings.company_address,
    company_gst_number: settings.company_gst_number,
    company_phone: settings.company_phone,
    company_email: settings.company_email,
    company_website: settings.company_website || '',
    bank_name: settings.bank_name,
    bank_account: settings.bank_account,
    bank_ifsc: settings.bank_ifsc,
    logo_url: settings.logo_url || '',
    primary_color: settings.primary_color,
    invoice_footer: settings.invoice_footer,
  });

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload PNG, JPG, SVG, or WebP.');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 5MB.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      const logoUrl = urlData.publicUrl;

      // Update form and save to database
      setForm(f => ({ ...f, logo_url: logoUrl }));
      await update({ logo_url: logoUrl });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Logo upload error:', err);
      setUploadError('Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function removeLogo() {
    if (!form.logo_url) return;

    try {
      // Extract file path from URL
      const url = new URL(form.logo_url);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.findIndex(p => p === 'logos');
      if (bucketIndex !== -1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');
        await supabase.storage.from('logos').remove([filePath]);
      }
    } catch {
      // Ignore deletion errors
    }

    setForm(f => ({ ...f, logo_url: '' }));
    await update({ logo_url: null });
  }

  async function handleSave(fields: Partial<CompanySettings>) {
    setSaving(true);
    await update(fields);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'company', label: 'Company Info', icon: Building2 },
    { id: 'branding', label: 'Branding & Theme', icon: Palette },
    { id: 'bank', label: 'Bank Details', icon: Landmark },
    { id: 'invoice', label: 'Invoice Settings', icon: FileText },
  ];

  const inputClass = 'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent transition-colors';
  const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 shadow-sm overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Company Info Tab */}
      {activeTab === 'company' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Company Information</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Your business details used across invoices and reports</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Company Name</label>
                <input className={inputClass} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>GST Number</label>
                <input className={inputClass} value={form.company_gst_number} onChange={e => setForm(f => ({ ...f, company_gst_number: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <input className={inputClass} value={form.company_address} onChange={e => setForm(f => ({ ...f, company_address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Phone</label>
                <input className={inputClass} value={form.company_phone} onChange={e => setForm(f => ({ ...f, company_phone: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input className={inputClass} type="email" value={form.company_email} onChange={e => setForm(f => ({ ...f, company_email: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input className={inputClass} placeholder="https://" value={form.company_website} onChange={e => setForm(f => ({ ...f, company_website: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => handleSave({
                  company_name: form.company_name,
                  company_address: form.company_address,
                  company_gst_number: form.company_gst_number,
                  company_phone: form.company_phone,
                  company_email: form.company_email,
                  company_website: form.company_website || null,
                })}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Branding & Theme</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Customize your app theme and company logo</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Logo Upload */}
            <div>
              <label className={labelClass}>Company Logo</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Upload your company logo (PNG, JPG, SVG, or WebP - max 5MB). This will appear in the header of all invoices and reports.</p>

              {form.logo_url ? (
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <img src={form.logo_url} alt="Logo preview" className="h-16 w-auto object-contain max-w-[200px]" onError={e => { (e.target as HTMLImageElement).src = '/placeholder-logo.png'; }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Logo Uploaded</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">This logo appears on invoices and reports</p>
                  </div>
                  <button
                    onClick={removeLogo}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title="Remove logo"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-teal-500 dark:hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  {uploading ? (
                    <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Upload size={32} className="text-slate-400 dark:text-slate-500 mb-2" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Click to upload logo</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">PNG, JPG, SVG, or WebP (max 5MB)</p>
                    </>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />

              {uploadError && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">{uploadError}</p>
              )}

              {/* Alternative: URL input */}
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Or enter logo URL manually:</label>
                <input
                  className={`${inputClass} mt-1.5`}
                  placeholder="https://example.com/logo.png"
                  value={form.logo_url}
                  onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
                />
              </div>
            </div>

            {/* Color Theme */}
            <div>
              <label className={labelClass}>Primary Color</label>
              <div className="flex flex-wrap gap-3 mt-2">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setForm(f => ({ ...f, primary_color: color.value }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      form.primary_color === color.value
                        ? 'border-slate-800 dark:border-slate-200 shadow-sm'
                        : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                    style={{ backgroundColor: `${color.value}15`, color: color.value }}
                  >
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color.value }} />
                    {color.name}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-600"
                />
                <input
                  className={`${inputClass} max-w-[140px]`}
                  value={form.primary_color}
                  onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                  placeholder="#0d9488"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">Custom color</span>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Invoice Header Preview</p>
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="h-12 w-auto object-contain max-w-[120px]" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: form.primary_color }}>
                    {form.company_name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-bold text-lg" style={{ color: form.primary_color }}>{form.company_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{form.company_address}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => handleSave({
                  logo_url: form.logo_url || null,
                  primary_color: form.primary_color,
                })}
                disabled={saving || uploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Details Tab */}
      {activeTab === 'bank' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Bank Details</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Bank information displayed on invoices</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className={labelClass}>Bank Name</label>
              <input className={inputClass} value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Account Number</label>
                <input className={inputClass} value={form.bank_account} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>IFSC Code</label>
                <input className={inputClass} value={form.bank_ifsc} onChange={e => setForm(f => ({ ...f, bank_ifsc: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => handleSave({
                  bank_name: form.bank_name,
                  bank_account: form.bank_account,
                  bank_ifsc: form.bank_ifsc,
                })}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Settings Tab */}
      {activeTab === 'invoice' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Invoice Settings</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Customize invoice footer and display options</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className={labelClass}>Invoice Footer Text</label>
              <textarea
                className={`${inputClass} h-20 resize-none`}
                value={form.invoice_footer}
                onChange={e => setForm(f => ({ ...f, invoice_footer: e.target.value }))}
              />
            </div>
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Footer Preview</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{form.invoice_footer || 'Thank you for your business!'}</p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => handleSave({ invoice_footer: form.invoice_footer })}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
