export const site = {
  name: 'NextStep',
  team: 'Team Apex',
  tagline: 'Plans change. Keep moving.',
  description:
    'NextStep helps students organise coursework, build realistic study plans and recover when life disrupts them. Built by Team Apex for students balancing study, work, commuting and family.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
  downloads: {
    android: process.env.NEXT_PUBLIC_ANDROID_URL || '',
    ios: process.env.NEXT_PUBLIC_IOS_URL || '',
    apk: process.env.NEXT_PUBLIC_APK_URL || '',
  },
};

export const hasDownloads = () => Boolean(site.downloads.android || site.downloads.ios || site.downloads.apk);

export const nav = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/community', label: 'Access & community' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
] as const;

export const footerNav = [
  { href: '/demo', label: 'Try the demo' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/community', label: 'Community & accessibility' },
  { href: '/about', label: 'About Team Apex' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;
