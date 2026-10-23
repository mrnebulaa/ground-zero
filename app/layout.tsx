import './globals.css';
export const metadata = { title: 'Ground Zero', description: 'Evidence. Dialogue. Accountability.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
