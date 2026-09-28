import { View } from 'react-native';

/** Static placeholder block for loading states (structured, dark). */
export default function Skeleton({ className }: { className?: string }) {
  return <View className={`bg-edge ${className ?? ''}`} />;
}
