'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, ArrowLeft, Sparkles, Clock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Header } from '@/components/dashboard/header';

const campaignSchema = z.object({
  campaign_name: z.string().min(3, 'Campaign name must be at least 3 characters'),
  service_type: z.string().min(1, 'Service type is required'),
  target_region: z.string().min(1, 'Target region is required'),
  campaign_goal: z.string().min(1, 'Campaign goal is required'),
  campaign_message: z.string().min(10, 'Campaign message must be at least 10 characters'),
  cta_button_text: z.string().min(1, 'CTA button text is required'),
  cta_link: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  tone: z.string().min(1, 'Tone is required'),
  selected_sheet: z.string().min(1, 'Lead sheet is required'),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

// Loading step messages shown while n8n processes
const LOADING_STEPS = [
  { at: 0,   text: 'Sending campaign brief to n8n...' },
  { at: 5,   text: 'Validating campaign data...' },
  { at: 12,  text: 'Reading leads from Google Sheets...' },
  { at: 25,  text: 'AI is crafting your email content...' },
  { at: 55,  text: 'Finalising subject line and preview text...' },
  { at: 90,  text: 'Almost done — saving campaign...' },
  { at: 115, text: 'Wrapping up, hang tight...' },
];

function LoadingOverlay({ elapsed }: { elapsed: number }) {
  const step = [...LOADING_STEPS].reverse().find((s) => elapsed >= s.at) ?? LOADING_STEPS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center space-y-6">
        {/* Animated logo ring */}
        <div className="relative mx-auto h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Generating AI Campaign</h3>
          <p className="text-sm text-indigo-600 font-medium min-h-[20px] transition-all">
            {step.text}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-zinc-100 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min((elapsed / 120) * 100, 95)}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          <span>{elapsed}s elapsed · typically 50–120s</span>
        </div>

        <p className="text-xs text-gray-400">
          Do not close this tab — the AI is writing your campaign email
        </p>
      </div>
    </div>
  );
}

export default function NewCampaignPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isReuse, setIsReuse] = useState(false);
  const reusedRef = useRef(false);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      cta_button_text: 'Book Free Consultation',
      cta_link: 'https://www.togahh.com/en/contact',
    },
  });

  // Pre-fill form if coming from "Reuse" action
  useEffect(() => {
    if (reusedRef.current) return;
    const stored = sessionStorage.getItem('reuse_campaign');
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      sessionStorage.removeItem('reuse_campaign');
      reusedRef.current = true;
      setIsReuse(true);
      // Reset form with old values
      form.reset({
        campaign_name: data.campaign_name ? `${data.campaign_name} (Copy)` : '',
        service_type: data.service_type ?? '',
        target_region: data.target_region ?? '',
        campaign_goal: data.campaign_goal ?? '',
        campaign_message: data.campaign_message ?? '',
        cta_button_text: data.cta_button_text ?? 'Book Free Consultation',
        cta_link: data.cta_link ?? 'https://www.togahh.com/en/contact',
        tone: data.tone ?? '',
        selected_sheet: data.selected_sheet ?? '',
      });
    } catch {
      sessionStorage.removeItem('reuse_campaign');
    }
  }, [form]);

  // Tick the elapsed counter while submitting
  useEffect(() => {
    if (!isSubmitting) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isSubmitting]);

  const onSubmit = async (data: CampaignFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create campaign');
      }

      toast({
        title: '✅ Campaign created successfully!',
        description: 'AI content generated. Review and approve it to send emails.',
      });

      router.push('/dashboard/campaigns');

    } catch (error: unknown) {
      setIsSubmitting(false);
      toast({
        title: 'Campaign creation failed',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      {/* Full-screen loading overlay while n8n processes */}
      {isSubmitting && <LoadingOverlay elapsed={elapsed} />}

      <div>
        <Header
          title={isReuse ? 'Reuse Campaign' : 'New Campaign'}
          description={isReuse ? 'Pre-filled from previous campaign — edit and create new' : 'AI generates the email content — you review and approve before sending'}
        />

        <div className="p-6 max-w-2xl mx-auto">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => router.back()} className="text-gray-600">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Campaigns
            </Button>
          </div>

          {/* Reuse banner */}
        {isReuse && (
          <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            <Copy className="h-4 w-4 flex-shrink-0" />
            <p>
              <span className="font-semibold">Reusing previous campaign.</span>{' '}
              All fields pre-filled — edit anything before creating.
            </p>
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Campaign Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign Details</CardTitle>
                <CardDescription>Basic information about this campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                  <Input
                    {...form.register('campaign_name')}
                    placeholder="e.g. April Hair Transplant Awareness"
                    disabled={isSubmitting}
                  />
                  {form.formState.errors.campaign_name && (
                    <p className="text-red-500 text-xs mt-1">{form.formState.errors.campaign_name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                    <Select onValueChange={(v) => form.setValue('service_type', v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Hair_Transplant">Hair Transplant</SelectItem>
                        <SelectItem value="Dental_Treatment">Dental Treatment</SelectItem>
                        <SelectItem value="Cosmetic_Surgery">Cosmetic Surgery</SelectItem>
                        <SelectItem value="Eye_Treatment">Eye Treatment</SelectItem>
                        <SelectItem value="IVF_Fertility">IVF Fertility</SelectItem>
                        <SelectItem value="Thermal_Wellness">Thermal Wellness</SelectItem>
                        <SelectItem value="All_Services">All Services</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.service_type && (
                      <p className="text-red-500 text-xs mt-1">{form.formState.errors.service_type.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Region</label>
                    <Select onValueChange={(v) => form.setValue('target_region', v)} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe">Europe</SelectItem>
                        <SelectItem value="Middle East">Middle East</SelectItem>
                        <SelectItem value="Asia">Asia</SelectItem>
                        <SelectItem value="North America">North America</SelectItem>
                        <SelectItem value="Global">Global</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.target_region && (
                      <p className="text-red-500 text-xs mt-1">{form.formState.errors.target_region.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lead Sheet</label>
                  <Select onValueChange={(v) => form.setValue('selected_sheet', v)} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select Google Sheet tab" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hair Transplant Leads">Hair Transplant Leads</SelectItem>
                      <SelectItem value="Dental Treatment Leads">Dental Treatment Leads</SelectItem>
                      <SelectItem value="Cosmetic Surgery Leads">Cosmetic Surgery Leads</SelectItem>
                      <SelectItem value="IVF Fertility Leads">IVF Fertility Leads</SelectItem>
                      <SelectItem value="Eye Treatment Leads">Eye Treatment Leads</SelectItem>
                      <SelectItem value="All Services Leads">All Services Leads</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.selected_sheet && (
                    <p className="text-red-500 text-xs mt-1">{form.formState.errors.selected_sheet.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Email Content */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email Content</CardTitle>
                <CardDescription>AI will craft the full email from your brief</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Goal</label>
                  <Select onValueChange={(v) => form.setValue('campaign_goal', v)} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="What's the goal?" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Book consultation">Book consultation</SelectItem>
                      <SelectItem value="Share educational content">Share educational content</SelectItem>
                      <SelectItem value="Announce new service">Announce new service</SelectItem>
                      <SelectItem value="Patient testimonial spotlight">Patient testimonial spotlight</SelectItem>
                      <SelectItem value="Seasonal awareness campaign">Seasonal awareness campaign</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.campaign_goal && (
                    <p className="text-red-500 text-xs mt-1">{form.formState.errors.campaign_goal.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Message</label>
                  <Textarea
                    {...form.register('campaign_message')}
                    placeholder="Describe what you want to communicate. The AI will write the full email from this brief..."
                    rows={5}
                    disabled={isSubmitting}
                  />
                  {form.formState.errors.campaign_message && (
                    <p className="text-red-500 text-xs mt-1">{form.formState.errors.campaign_message.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Tone</label>
                  <Select onValueChange={(v) => form.setValue('tone', v)} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Select tone" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Warm and educational">Warm and educational</SelectItem>
                      <SelectItem value="Professional and authoritative">Professional and authoritative</SelectItem>
                      <SelectItem value="Friendly and conversational">Friendly and conversational</SelectItem>
                      <SelectItem value="Urgent and action-oriented">Urgent and action-oriented</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.tone && (
                    <p className="text-red-500 text-xs mt-1">{form.formState.errors.tone.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Call to Action</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                  <Input
                    {...form.register('cta_button_text')}
                    placeholder="Book Free Consultation"
                    disabled={isSubmitting}
                  />
                  {form.formState.errors.cta_button_text && (
                    <p className="text-red-500 text-xs mt-1">{form.formState.errors.cta_button_text.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Button Link (optional)</label>
                  <Input
                    {...form.register('cta_link')}
                    placeholder="https://www.togahh.com/en/contact"
                    disabled={isSubmitting}
                  />
                  {form.formState.errors.cta_link && (
                    <p className="text-red-500 text-xs mt-1">{form.formState.errors.cta_link.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating AI Content...</>
              ) : (
                <><Sparkles className="mr-2 h-5 w-5" /> Create Campaign &amp; Generate Content</>
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
