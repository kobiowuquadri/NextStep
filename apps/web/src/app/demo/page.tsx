import type { Metadata } from 'next';
import DemoApp from '@/demo/DemoApp';

export const metadata: Metadata = {
  title: 'Demo',
  description: 'Try NextStep in your browser with a fictional student. See Recovery Mode rebuild a week after plans change. Changes stay in your browser.',
  robots: { index: true, follow: true },
};

export default function DemoPage() {
  return <DemoApp />;
}
