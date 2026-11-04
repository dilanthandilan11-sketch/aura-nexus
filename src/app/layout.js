import { Orbitron, Raleway, Sora, JetBrains_Mono } from 'next/font/google'
import './fonts.css'
import './globals.css'

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-nav',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata = {
  title: 'Aura Infotech | Building Digital Solutions',
  description: 'Software Development, Web Development, Digital Marketing, and more.',
}
// Use `icons` to specify favicons and platform icons. If you have `Logo-A.png`,
// place it into `public/` and update the paths below to `/Logo-A.png`.

export const icons = {
  icon: '/Logo-A.png',
  shortcut: '/Logo-A.png',
  apple: '/Logo-A.png',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${raleway.variable} ${sora.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}