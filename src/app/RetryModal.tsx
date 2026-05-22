'use client';

import { useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, RefreshCw, MessageSquare } from 'lucide-react';

interface RetryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (prompt: string) => void;
  loading?: boolean;
}

export default function RetryModal({ isOpen, onOpenChange, onSubmit, loading }: RetryModalProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(prompt);
    setPrompt('');
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1000] bg-zinc-900/40 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[1001] max-h-[90vh] w-[90%] max-w-[440px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-7 py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50">
                <RefreshCw size={20} className="text-orange-600" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-extrabold tracking-tight text-zinc-900">
                  Retry Generation
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-[13px] text-zinc-500">
                  Provide feedback or a new prompt for the AI.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-7">
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-600">
                <MessageSquare size={13} /> Retry Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Make it more professional, or add more details about the implants..."
                required
                className="min-h-[100px] w-full resize-y rounded-[10px] border-[1.5px] border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] text-zinc-900 transition-all focus:border-orange-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-600/10"
              />
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-[10px] border-[1.5px] border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-[10px] bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-orange-700 hover:shadow-md hover:shadow-orange-600/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:bg-orange-600"
              >
                {loading ? 'Processing...' : 'Submit Retry'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
