import "./globals.css";

export const metadata = {
  title: "Set Studio | YouTube DJ",
  description: "Describe your vibe, build a set from YouTube tracks, and play it through an editable queue.",
  keywords: "YouTube DJ, DJ mixer, online DJ, mix music, crossfader, YouTube player",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#050508" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
