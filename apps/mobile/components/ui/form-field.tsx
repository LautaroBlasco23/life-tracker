import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { cn } from '../../lib/cn';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function FormField({ label, error, secureTextEntry, className, ...props }: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View className="space-y-1.5">
      <Text className="text-sm text-foreground dark:text-dark-foreground">{label}</Text>
      <View className="flex-row items-center">
        <TextInput
          className={cn(
            'h-11 flex-1 rounded-lg border border-border dark:border-dark-border bg-transparent px-3 text-foreground dark:text-dark-foreground',
            className
          )}
          placeholderTextColor="#57606a"
          secureTextEntry={isPassword && !showPassword}
          autoCapitalize="none"
          {...props}
        />
        {isPassword ? (
          <Pressable onPress={() => setShowPassword((s) => !s)} className="ml-2 p-2">
            <Text className="text-primary dark:text-dark-primary text-sm">
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-sm text-danger dark:text-dark-danger">{error}</Text> : null}
    </View>
  );
}
