/**
 * PollSheet — bottom sheet where the leader writes a poll: a question and 2–6 options.
 */
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useThemeColors } from '@/hooks/useThemeColors';

const MAX_OPTIONS = 6;

interface PollSheetProps {
  visible: boolean;
  sending: boolean;
  onClose: () => void;
  onSend: (poll: { question: string; options: string[] }) => void;
}

/** @param props.onSend - Called with the cleaned poll */
export function PollSheet({ visible, sending, onClose, onSend }: PollSheetProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const cleaned = options.map((option) => option.trim()).filter(Boolean);
  const canSend = question.trim().length >= 3 && cleaned.length >= 2;

  const send = () => {
    onSend({ question: question.trim(), options: cleaned });
    setQuestion('');
    setOptions(['', '']);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 bg-black/40"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      />
      <View
        className="max-h-[85%] rounded-t-card bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
      >
        <View className="mb-3 h-1.5 w-12 self-center rounded-full bg-line" />
        <AppText variant="heading" className="mb-4">
          {t('chat.newPoll')}
        </AppText>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
          <TextField
            label={t('chat.pollQuestion')}
            value={question}
            onChangeText={setQuestion}
            maxLength={200}
          />
          {options.map((option, index) => (
            <View key={`option-${index}`} className="flex-row items-end gap-2">
              <View className="flex-1">
                <TextField
                  label={t('chat.pollOption', { number: index + 1 })}
                  value={option}
                  onChangeText={(text) =>
                    setOptions((current) => current.map((item, i) => (i === index ? text : item)))
                  }
                  maxLength={80}
                />
              </View>
              {options.length > 2 ? (
                <Pressable
                  onPress={() => setOptions((current) => current.filter((_item, i) => i !== index))}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.removeOption', { number: index + 1 })}
                  className="mb-1 h-12 w-12 items-center justify-center"
                >
                  <X size={20} color={colors.muted} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {options.length < MAX_OPTIONS ? (
            <Button
              label={t('chat.addOption')}
              icon={Plus}
              variant="ghost"
              onPress={() => setOptions((current) => [...current, ''])}
            />
          ) : null}
          <Button label={t('chat.sendPoll')} disabled={!canSend} loading={sending} onPress={send} />
        </ScrollView>
      </View>
    </Modal>
  );
}
