'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Wand2, Music, Mic2, Monitor, MessageSquare, Tag } from 'lucide-react';
import { Spinner } from './components';

interface GeneratorFormData {
  category: string;
  description: string;
  videoStyle: string;
  language: string;
  voice: string;
  backgroundSong: string;
}

interface GeneratorModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GeneratorFormData) => void;
  loading?: boolean;
}

const labelClass =
  'flex items-center gap-1.5 text-xs font-bold tracking-wide text-zinc-600';
const fieldBaseClass =
  'w-full rounded-[10px] border-[1.5px] border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-[13px] text-zinc-900 transition-all focus:border-sky-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-600/10';

export default function GeneratorModal({
  isOpen,
  onOpenChange,
  onSubmit,
  loading,
}: GeneratorModalProps) {
  const [formData, setFormData] = useState<GeneratorFormData>({
    category: 'hair_transplant',
    description: '',
    videoStyle: 'Highly Realistic 4k, real life',
    language: 'English',
    voice: 'KLoLpdGWK7agg0O2TJYg',
    backgroundSong: 'Inspirational - Sunrise Bloom',
  });

  const handleChange = (
    e: ChangeEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1000] bg-zinc-900/40 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[1001] max-h-[90vh] w-[90%] max-w-[540px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-7 py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50">
                <Wand2 size={20} className="text-sky-600" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-extrabold tracking-tight text-zinc-900">
                  Video AI Generation
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-[13px] text-zinc-500">
                  Configure your story and style preferences.
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Category */}
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Tag size={13} /> Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={fieldBaseClass}
                >
                  <option value="hair_transplant">Hair Transplant</option>
                  <option value="dental_treatment">Dental Treatment</option>
                  <option value="liposuction">Liposuction - Fat Removal</option>
                  <option value="nose_job">Nose Job - Rhinoplasty</option>
                </select>
              </div>

              {/* Video Style */}
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Monitor size={13} /> Video Style
                </label>
                <select
                  name="videoStyle"
                  value={formData.videoStyle}
                  onChange={handleChange}
                  className={fieldBaseClass}
                >
                  <option value="Highly Realistic 4k, real life">
                    Highly Realistic 4k, real life
                  </option>
                  <option value="Cinematic Drone - Smooth">Cinematic Drone - Smooth</option>
                  <option value="Studio Professional - Clean">
                    Studio Professional - Clean
                  </option>
                </select>
              </div>

              {/* Language */}
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Language</label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
                  className={fieldBaseClass}
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                </select>
              </div>

              {/* Voice */}
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Mic2 size={13} /> Voice
                </label>
                <select
                  name="voice"
                  value={formData.voice}
                  onChange={handleChange}
                  className={fieldBaseClass}
                >
                  <option value="wrxvN1LZJIfL3HHvffqe">Bella - Lady</option>
                  <option value="odyUrTN5HMVKujvVAgWW">Emily - Lady</option>
                  <option value="aD6riP1btT197c6dACmy">Rachel - Lady</option>
                  <option value="eqz5FuihuZwmJPuvZ65E">Jess</option>
                  <option value="KLoLpdGWK7agg0O2TJYg">Charlie - Men</option>
                  <option value="KClAuq9Hs0wFY7oJmaGN">Maayan-Lady</option>
                </select>
              </div>

              {/* Background Song */}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className={labelClass}>
                  <Music size={13} /> Background Song
                </label>
                <select
                  name="backgroundSong"
                  value={formData.backgroundSong}
                  onChange={handleChange}
                  className={fieldBaseClass}
                >
                  <option value="Inspirational - Sunrise Bloom">
                    Inspirational - Sunrise Bloom
                  </option>
                  <option value="Upbeat - Corporate Drive">Upbeat - Corporate Drive</option>
                  <option value="Lo-fi - Midnight Study">Lo-fi - Midnight Study</option>
                  <option value="Cinematic - Epic Journey">Cinematic - Epic Journey</option>
                  <option value="Ambient - Calm Waters">Ambient - Calm Waters</option>
                </select>
              </div>

              {/* Story Description */}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className={labelClass}>
                  <MessageSquare size={13} /> Story Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Tell your patient story or describe the blog post content..."
                  required
                  className={`${fieldBaseClass} min-h-[100px] resize-y`}
                />
              </div>
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
                className="flex items-center gap-2 rounded-[10px] bg-sky-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-sky-700 hover:shadow-md hover:shadow-sky-600/30 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:bg-sky-600"
              >
                {loading ? (
                  <>
                    <Spinner size={14} color="#ffffff" /> Generating...
                  </>
                ) : (
                  'Generate Video'
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
