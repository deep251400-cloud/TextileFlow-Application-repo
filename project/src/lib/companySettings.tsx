import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

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

const defaultSettings: CompanySettings = {
  id: '',
  company_name: 'TextileFlow',
  company_address: 'Textile Market, Ring Road, Surat, Gujarat 395002',
  company_gst_number: '24AABCT0000F1Z5',
  company_phone: '0261-2345678',
  company_email: 'billing@textileflow.in',
  company_website: null,
  bank_name: 'SBI',
  bank_account: '3824567890',
  bank_ifsc: 'SBIN0001234',
  logo_url: null,
  primary_color: '#0d9488',
  invoice_footer: 'Thank you for your business!',
  created_at: '',
  updated_at: '',
};

interface CompanySettingsContextType {
  settings: CompanySettings;
  loading: boolean;
  refresh: () => Promise<void>;
  update: (s: Partial<CompanySettings>) => Promise<void>;
}

const CompanySettingsContext = createContext<CompanySettingsContextType>({
  settings: defaultSettings,
  loading: true,
  refresh: async () => {},
  update: async () => {},
});

export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const { data } = await supabase.from('company_settings').select('*').limit(1).single();
      if (data) setSettings(data as CompanySettings);
    } catch {
      // Table might be empty, use defaults
    }
    setLoading(false);
  }

  async function update(s: Partial<CompanySettings>) {
    if (!settings.id) {
      const { data } = await supabase.from('company_settings').insert(s).select().single();
      if (data) setSettings(data as CompanySettings);
      return;
    }
    const { data } = await supabase
      .from('company_settings')
      .update({ ...s, updated_at: new Date().toISOString() })
      .eq('id', settings.id)
      .select()
      .single();
    if (data) setSettings(data as CompanySettings);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <CompanySettingsContext.Provider value={{ settings, loading, refresh, update }}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export function useCompanySettings() {
  return useContext(CompanySettingsContext);
}
