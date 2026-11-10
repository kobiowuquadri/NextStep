import type { Metadata } from 'next';
import DemoApp from '@/demo/DemoApp';

export const metadata: Metadata = {
  title: 'Interactive demo',
  description: 'Try NextStep in your browser with a fictional student. See Recovery Mode rebuild a week after plans change. Changes stay in your browser.',
  robots: { index: true, follow: true },
};

export default function InteractiveDemoPage() {
  return <DemoApp />;
}
