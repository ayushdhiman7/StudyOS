import type { Metadata } from "next";
import { Archivo_Black, Work_Sans } from "next/font/google";
import { PrimaryNav } from "@/components/nav";
import { ThemeSync, ThemeToggle } from "@/components/theme-sync";
import { getPrefs } from "@/lib/store";
import "./globals.css";

const workSans = Work_Sans({ variable: "--font-work", subsets: ["latin"], weight: ["400", "500", "700"] });
const archivoBlack = Archivo_Black({ variable: "--font-archivo", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "StudyOS AI",
  description: "Personal software engineering study companion",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const prefs = await getPrefs();
  return (
    <html lang="en" data-theme={prefs.theme} className={`${workSans.variable} ${archivoBlack.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var stored=localStorage.getItem("studyos-theme");var server=document.documentElement.getAttribute("data-theme");var t=stored||server||"system";var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full bg-canvas font-sans text-ink">
        <ThemeSync theme={prefs.theme} />
        <PrimaryNav theme={prefs.theme} />
        <div className="min-h-full md:pl-60">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-line bg-canvas/95 px-4 py-3 md:hidden">
            <p className="text-xs font-bold tracking-[0.12em]">STUDYOS</p>
            <div className="w-36">
              <ThemeToggle theme={prefs.theme} />
            </div>
          </header>
          <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-12 md:pb-12 md:pt-10">{children}</div>
        </div>
      </body>
    </html>
  );
}
