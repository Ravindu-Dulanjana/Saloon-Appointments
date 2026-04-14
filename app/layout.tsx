export const metadata = {
  title: 'Saloon Booking Bot',
  description: 'WhatsApp booking bot for salons',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
