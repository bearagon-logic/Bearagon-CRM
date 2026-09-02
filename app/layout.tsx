import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"Bearagon Client Onboarding", description:"Manage every Bearagon client from signed agreement to successful launch.", icons:{icon:"/favicon.svg"} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
