'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search, Loader2, CheckCircle, ExternalLink, History,
  Users, Mail, XCircle, HelpCircle, Clock, BarChart3,
} from 'lucide-react';
import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScraperSummary {
  niches: string;
  location: string;
  total_scraped: number;
  verified_leads: number;
  invalid_leads: number;
  unknown_leads: number;
  success_rate: string;
}

interface SheetInfo {
  sheet_tab: string;
  sheet_url: string;
  leads_added: number;
}

interface ScraperResult {
  summary: ScraperSummary;
  sheetInfo: SheetInfo;
  executionTime?: number;
}

type PageState = 'form' | 'loading' | 'success' | 'error';

// ─── Loading steps (2-5 min process) ─────────────────────────────────────────

const LOADING_STEPS = [
  { at: 0,   text: 'Sending request to n8n scraper workflow...' },
  { at: 8,   text: 'Connecting to Apify Google Maps scraper...' },
  { at: 20,  text: 'Scraping Google Maps for businesses...' },
  { at: 60,  text: 'Extracting business contact details...' },
  { at: 120, text: 'Validating email addresses...' },
  { at: 180, text: 'Saving verified leads to Google Sheets...' },
  { at: 240, text: 'Finalising and updating records...' },
  { at: 290, text: 'Almost done — wrapping up...' },
];

const SHEETS = [
  'Hair Transplant Leads',
  'Dental Treatment Leads',
  'Cosmetic Surgery Leads',
  'IVF Fertility Leads',
  'Eye Treatment Leads',
  'All Services Leads',
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScraperPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pageState, setPageState] = useState<PageState>('form');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields
  const [niches, setNiches] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState('100');
  const [targetSheet, setTargetSheet] = useState('');

  // Elapsed timer
  useEffect(() => {
    if (pageState !== 'loading') { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [pageState]);

  const currentStep = [...LOADING_STEPS].reverse().find((s) => elapsed >= s.at) ?? LOADING_STEPS[0];
  const progressPct = Math.min((elapsed / 300) * 100, 95);

  function formatTime(s: number) {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!niches.trim() || !location.trim() || !targetSheet) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    setPageState('loading');
    setResult(null);
    setErrorMsg('');

    try {
      const res = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niches: niches.trim(),
          location: location.trim(),
          max_results: Number(maxResults),
          target_sheet: targetSheet,
        }),
        signal: AbortSignal.timeout(320000),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Scraper failed');
      }

      setResult(data);
      setPageState('success');
      queryClient.invalidateQueries({ queryKey: ['scraper-jobs'] });
      toast({ title: '✅ Scraping complete!', description: `${data.summary?.verified_leads ?? 0} verified leads saved.` });

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error occurred');
      setPageState('error');
      toast({ title: 'Scraper failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    }
  }

  // ── FORM ───────────────────────────────────────────────────────────────────

  if (pageState === 'form' || pageState === 'loading') {
    return (
      <div>
        <Header
          title="Lead Scraper"
          description="Scrape Google Maps for business leads via Apify — verified emails only saved to sheet"
        />

        {/* Full-screen loading overlay */}
        {pageState === 'loading' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center space-y-6">
              <div className="relative mx-auto h-20 w-20">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="h-8 w-8 text-indigo-600" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900">Scraping Google Maps...</h3>
                <p className="text-sm text-indigo-600 mt-1 min-h-[20px] font-medium">{currentStep.text}</p>
              </div>

              <div className="w-full bg-zinc-100 rounded-full h-2.5">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                <span>{formatTime(elapsed)} elapsed · typically 2–5 minutes</span>
              </div>

              <p className="text-xs text-gray-300">Do not close this tab</p>
            </div>
          </div>
        )}

        <div className="p-6 max-w-2xl mx-auto">
          <div className="flex justify-end mb-4">
            <Button variant="outline" asChild className="gap-2 text-sm">
              <Link href="/dashboard/scraper/history">
                <History className="h-4 w-4" /> View History
              </Link>
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Search Configuration</CardTitle>
                <CardDescription>Configure what to scrape on Google Maps via Apify</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Niches */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Niches <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={niches}
                    onChange={(e) => setNiches(e.target.value)}
                    placeholder="e.g. hair transplant clinic, dental clinic, cosmetic surgery"
                    disabled={pageState === 'loading'}
                  />
                  <p className="text-xs text-gray-400 mt-1">Comma-separated list of business types to search</p>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. London UK, Toronto Canada, Dubai UAE"
                    disabled={pageState === 'loading'}
                  />
                </div>

                {/* Max Results */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Results <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={10}
                    max={500}
                    value={maxResults}
                    onChange={(e) => setMaxResults(e.target.value)}
                    disabled={pageState === 'loading'}
                  />
                  <p className="text-xs text-gray-400 mt-1">Max 500 per run. More results = longer time.</p>
                </div>

                {/* Target Sheet */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Save Verified Leads To <span className="text-red-500">*</span>
                  </label>
                  <Select onValueChange={setTargetSheet} disabled={pageState === 'loading'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Google Sheet tab" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHEETS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400 mt-1">Only verified emails are saved here</p>
                </div>
              </CardContent>
            </Card>

            {/* Info box */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 space-y-1">
              <p className="font-semibold">What gets saved to Google Sheets:</p>
              <p className="text-xs text-indigo-700">
                first_name · last_name · mobile_number · personal_email · linkedin · city · country · email_status
              </p>
              <p className="text-xs text-indigo-600 mt-1">Invalid emails go to a separate "Invalid_Emails" sheet automatically.</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Note:</strong> Scraping takes 2–5 minutes depending on result count. Keep this tab open.
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              size="lg"
              disabled={pageState === 'loading'}
            >
              {pageState === 'loading' ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Scraping in progress...</>
              ) : (
                <><Search className="mr-2 h-5 w-5" /> Start Lead Scraping</>
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ── SUCCESS ────────────────────────────────────────────────────────────────

  if (pageState === 'success' && result) {
    const { summary, sheetInfo, executionTime } = result;

    return (
      <div>
        <Header title="Lead Scraper" description="Scraping completed successfully" />

        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Success header */}
          <div className="flex flex-col items-center text-center py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-3">
              <CheckCircle className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Scraping Complete!</h2>
            <p className="text-sm text-gray-500 mt-1">
              {summary.location} · {executionTime ? formatTime(executionTime) : formatTime(elapsed)}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Scraped', value: summary.total_scraped, icon: Search, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
              { label: 'Verified', value: summary.verified_leads, icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
              { label: 'Invalid', value: summary.invalid_leads, icon: XCircle, color: 'text-red-500 bg-red-50 border-red-200' },
              { label: 'Unknown', value: summary.unknown_leads, icon: HelpCircle, color: 'text-gray-500 bg-gray-50 border-gray-200' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
                <Icon className="h-5 w-5 mx-auto mb-1 opacity-70" />
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Success rate */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <BarChart3 className="h-4 w-4 text-indigo-600" />
                  Email Verification Rate
                </div>
                <span className="text-lg font-bold text-indigo-600">{summary.success_rate}</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2.5">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full"
                  style={{ width: summary.success_rate }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>{summary.verified_leads} verified</span>
                <span>{summary.total_scraped} total</span>
              </div>
            </CardContent>
          </Card>

          {/* Sheet info */}
          {sheetInfo && (
            <Card className="border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <Users className="h-4 w-4" />
                  Leads Saved to Google Sheets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sheet Tab</span>
                  <span className="font-medium">{sheetInfo.sheet_tab}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Leads Added</span>
                  <span className="font-bold text-green-600">{sheetInfo.leads_added}</span>
                </div>
                {sheetInfo.sheet_url && (
                  <Button
                    asChild
                    className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                  >
                    <a href={sheetInfo.sheet_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Google Sheet
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setPageState('form');
                setNiches('');
                setLocation('');
                setMaxResults('100');
                setTargetSheet('');
              }}
            >
              <Search className="h-4 w-4" /> Scrape Again
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href="/dashboard/scraper/history">
                <History className="h-4 w-4" /> View History
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <Header title="Lead Scraper" description="Something went wrong" />
      <div className="p-6 max-w-md mx-auto mt-8">
        <Card className="border-red-200">
          <CardContent className="pt-8 pb-6 text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-9 w-9 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Scraper Failed</h3>
              <p className="text-sm text-gray-500 mt-1">n8n workflow returned an error</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-left">
              {errorMsg || 'Unknown error occurred. Check your n8n workflow logs.'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setPageState('form')}>
                Try Again
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/scraper/history">View History</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
