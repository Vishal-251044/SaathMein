/**
 * Screen — standard screen wrapper: theme background, top safe-area padding, and a
 * scroll container with consistent side gutters. Bottom inset is handled by the tab bar.
 */
import { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cx } from '@/utils/genericFunctions';

interface ScreenProps {
  children: ReactNode;
  /** Scrollable content (default true). Use false for screens with their own lists. */
  scroll?: boolean;
  className?: string;
}

/**
 * @param props.children - Screen content
 * @param props.scroll - Wrap content in a ScrollView
 */
export function Screen({ children, scroll = true, className }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const contentClass = cx('w-full max-w-[640px] self-center px-4 pb-8', className);

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      {scroll ? (
        <ScrollView
          contentContainerClassName={cx('grow', contentClass)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cx('flex-1', contentClass)}>{children}</View>
      )}
    </View>
  );
}
