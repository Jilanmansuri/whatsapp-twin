import { ReactNode } from 'react';

export const metadata = {
  title: 'AI Assistant - Digital Twin',
  description: 'AI Personal Communication Assistant Module',
};

export default function AILayout({ children }: { children: ReactNode }) {
  return <div className="h-full flex flex-col">{children}</div>;
}
