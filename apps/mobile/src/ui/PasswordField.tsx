import { forwardRef, useState } from 'react';
import { Pressable, type TextInputInstance, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from './icons';
import { Field } from './kit';
import { useTheme } from './theme';

/** Password input with a show/hide button, so typos can be checked before submitting. */
export const PasswordField = forwardRef<TextInputInstance, TextInputProps & { label: string; error?: string | null; hint?: string }>(function PasswordField(props, ref) {
  const { c } = useTheme();
  const [shown, setShown] = useState(false);
  return (
    <Field
      {...props}
      ref={ref}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <Pressable onPress={() => setShown((v) => !v)} accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'} hitSlop={8} style={{ width: 48, height: 46, alignItems: 'center', justifyContent: 'center' }}>
          {shown ? <EyeOff size={20} color={c.textSecondary} /> : <Eye size={20} color={c.textSecondary} />}
        </Pressable>
      }
    />
  );
});

/** Loose check that catches obvious slips (missing @ or dot). The server still validates properly. */
export const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
