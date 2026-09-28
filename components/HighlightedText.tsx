import { useMemo } from 'react';
import { Text } from 'react-native';

import { escapeRegExp } from '@/lib/search';

interface HighlightedTextProps {
  text: string;
  /** Lowercase query tokens (see tokenizeForHighlight). */
  tokens: string[];
  className?: string;
  numberOfLines?: number;
}

/** Renders `text` with every token hit wrapped in a gold pill. */
export default function HighlightedText({ text, tokens, className, numberOfLines }: HighlightedTextProps) {
  const parts = useMemo(() => {
    if (tokens.length === 0) {
      return [text];
    }
    const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');
    return text.split(pattern);
  }, [text, tokens]);

  const lowered = useMemo(() => new Set(tokens), [tokens]);

  if (tokens.length === 0) {
    return (
      <Text className={className} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        lowered.has(part.toLowerCase()) ? (
          <Text key={i} className="bg-gold/30 font-bold text-paper">
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}
