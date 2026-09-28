import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type TemplateIcon = ComponentProps<typeof Ionicons>['name'];

export interface JournalTemplate {
  id: string;
  name: string;
  tagline: string;
  icon: TemplateIcon;
  /** Speaking cues (Talk mode) + starter headings (Write mode). */
  prompts: string[];
}

export const TEMPLATES: JournalTemplate[] = [
  {
    id: 'free-flow',
    name: 'Free Flow',
    tagline: 'No structure — just talk or write.',
    icon: 'document-text-outline',
    prompts: [],
  },
  {
    id: 'gratitude',
    name: 'Gratitude',
    tagline: 'Three good things and the people behind them.',
    icon: 'heart-outline',
    prompts: [
      "Three things I'm grateful for today",
      'Someone who made my day better',
      'A small moment I want to remember',
    ],
  },
  {
    id: 'daily-reflection',
    name: 'Daily Reflection',
    tagline: "Highs, lows, and tomorrow's intention.",
    icon: 'sunny-outline',
    prompts: [
      "Today's high point",
      "Today's low point",
      "One thing I'd do differently",
      "Tomorrow's intention",
    ],
  },
  {
    id: 'brain-dump',
    name: 'Brain Dump',
    tagline: 'Get everything out of your head.',
    icon: 'cloud-outline',
    prompts: [
      "What's on my mind right now",
      "What's weighing on me",
      'What I can let go of',
    ],
  },
  {
    id: 'goals',
    name: 'Goals & Intentions',
    tagline: 'Focus for today, one small step.',
    icon: 'flag-outline',
    prompts: [
      'My #1 focus',
      "One small step I'll take",
      "What 'done' looks like",
    ],
  },
];

/** Write-mode starter: each prompt followed by room to answer. */
export function starterFor(template: JournalTemplate): string {
  return template.prompts.map((p) => `${p}\n\n`).join('\n');
}
