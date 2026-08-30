import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { cn } from '../../lib/cn';

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

interface OptionSelectProps<T extends string> {
  label: string;
  value: T | null;
  options: Option<T>[];
  onSelect: (value: T) => void;
  placeholder?: string;
}

/** Label + tappable value that opens a bottom-sheet picker. */
export function OptionSelect<T extends string>({
  label,
  value,
  options,
  onSelect,
  placeholder = '—',
}: OptionSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      <Text className="text-sm text-foreground dark:text-dark-foreground mb-1.5">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="h-11 rounded-lg border border-border dark:border-dark-border px-3 flex-row items-center justify-between"
      >
        <Text
          className={cn(
            'text-base',
            selected ? 'text-foreground dark:text-dark-foreground' : 'text-muted dark:text-dark-muted'
          )}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color="#57606a" />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="max-h-[70%] rounded-t-2xl bg-background dark:bg-dark-background p-5">
            <Text className="text-lg font-semibold text-foreground dark:text-dark-foreground mb-3">
              {label}
            </Text>
            <ScrollView className="mb-2">
              {options.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onSelect(opt.value);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between py-3 border-b border-border dark:border-dark-border"
                >
                  <Text className="text-base text-foreground dark:text-dark-foreground">{opt.label}</Text>
                  {value === opt.value ? (
                    <Check size={18} color="#61dafb" />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} className="h-11 items-center justify-center">
              <Text className="text-base text-primary dark:text-dark-primary">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
