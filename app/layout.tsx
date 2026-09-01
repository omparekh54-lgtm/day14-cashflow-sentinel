import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cashflow Sentinel',
  description: '13-week probabilistic cash-risk and collections workbench for SMEs.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
