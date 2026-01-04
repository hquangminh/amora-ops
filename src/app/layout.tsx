import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amora Ops",
  description: "Quản lý đơn hàng & tồn kho Amora",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
