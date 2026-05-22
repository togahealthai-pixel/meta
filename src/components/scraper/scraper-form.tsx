'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { scraperSchema, type ScraperFormValues } from '@/lib/validations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function ScraperForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ScraperFormValues>({
    resolver: zodResolver(scraperSchema),
    defaultValues: {
      niches: '',
      location: '',
      max_results: 100,
      target_sheet: 'Hair Transplant Leads',
    },
  });

  const startScraper = useMutation({
    mutationFn: async (data: ScraperFormValues) => {
      const response = await axios.post('/api/scraper', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Scraper completed!',
        description: `Found ${data.n8nResponse?.results?.valid_emails || 0} valid leads`,
      });
      queryClient.invalidateQueries({ queryKey: ['scraper-jobs'] });
      form.reset();
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) ? error.response?.data?.error : 'Scraper failed';
      toast({
        title: 'Scraper failed',
        description: message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => startScraper.mutate(d))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search Configuration</CardTitle>
            <CardDescription>
              Configure what to search on Google Maps via Apify
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="niches"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Niches</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. hair clinic, beauty salon, cosmetic surgery"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated list of business types to search on Google Maps
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. London, UK" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_results"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Results</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Max 1000 results per run</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="target_sheet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Save to Sheet</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Hair Transplant Leads">Hair Transplant Leads</SelectItem>
                      <SelectItem value="Dental Treatment Leads">Dental Treatment Leads</SelectItem>
                      <SelectItem value="Cosmetic Surgery Leads">Cosmetic Surgery Leads</SelectItem>
                      <SelectItem value="IVF Fertility Leads">IVF Fertility Leads</SelectItem>
                      <SelectItem value="Eye Treatment Leads">Eye Treatment Leads</SelectItem>
                      <SelectItem value="All Services Leads">All Services Leads</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Which Google Sheet to save leads into</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Scraping can take 2-5 minutes depending on results count.
            The page will update automatically when complete.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          size="lg"
          disabled={startScraper.isPending}
        >
          {startScraper.isPending ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Search className="mr-2 h-5 w-5" />
          )}
          {startScraper.isPending ? 'Scraping Google Maps...' : 'Start Lead Scraper'}
        </Button>
      </form>
    </Form>
  );
}
