import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Code,
  Globe,
  Palette,
  BarChart,
  Lock,
  Zap,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Header } from '@/components/landing/header';
import { Footer } from '@/components/landing/footer';
import { MockChatWidget } from '@/components/landing/mock-chat-widget';

const features = [
  {
    icon: <Bot className="w-8 h-8 text-primary" />,
    title: 'RAG-Powered Answers',
    description: 'Delivers accurate responses by grounding the LLM in your own website content.',
  },
  {
    icon: <Globe className="w-8 h-8 text-primary" />,
    title: 'Multi-Tenant by Design',
    description: 'Securely manage multiple clients or projects under a single, unified platform.',
  },
  {
    icon: <Palette className="w-8 h-8 text-primary" />,
    title: 'Theme Customization',
    description: 'Automatically or manually customize the look and feel to match your brand perfectly.',
  },
  {
    icon: <BarChart className="w-8 h-8 text-primary" />,
    title: 'Usage Analytics',
    description: 'Track message counts and user engagement with a simple, clear analytics dashboard.',
  },
  {
    icon: <Lock className="w-8 h-8 text-primary" />,
    title: 'Secure Authentication',
    description: 'Robust user management with JWT, Google OAuth, and secure password handling.',
  },
  {
    icon: <Zap className="w-8 h-8 text-primary" />,
    title: 'Streaming Responses',
    description: 'Real-time, word-by-word responses from the LLM for a fluid chat experience.',
  },
];

const pricingTiers = [
  {
    name: 'Free',
    price: '₹0',
    description: 'For personal projects and testing.',
    features: ['100 messages/month', '1 website crawl', 'Branding included'],
    cta: 'Start for Free',
    href: '/register',
  },
  {
    name: 'Starter',
    price: '₹499',
    priceUnit: '/mo',
    description: 'For small businesses and startups.',
    features: ['1,000 messages/month', '1 website crawl', 'No branding', 'Email support'],
    cta: 'Get Started',
    href: '/register',
    popular: true,
  },
  {
    name: 'Pro',
    price: '₹1499',
    priceUnit: '/mo',
    description: 'For large-scale applications.',
    features: ['10,000 messages/month', '5 website crawls', 'API access', 'Priority support'],
    cta: 'Contact Sales',
    href: '#',
  },
];


export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow">
        <section id="hero" className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="text-center md:text-left">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 font-headline">
                  Add AI to your website in 60 seconds
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground mb-8">
                  Nocta is a RAG-powered AI chatbot platform that learns from your
                  content to provide instant, accurate answers to your users.
                </p>
                <div className="flex justify-center md:justify-start gap-4">
                  <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Link href="/register">
                      Start Free <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="#how-it-works">See Demo</Link>
                  </Button>
                </div>
              </div>
              <div className="relative flex items-center justify-center">
                 <div className="absolute w-full h-full bg-primary/10 rounded-full blur-3xl -z-10"></div>
                <MockChatWidget />
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 md:py-24 bg-card border-y">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-headline">How It Works</h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Deploy a powerful AI assistant on your site with three simple steps.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center">
                <div className="bg-background rounded-full p-4 mb-4 border shadow-inner">
                  <Globe className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Paste Your URL</h3>
                <p className="text-muted-foreground">
                  Enter the URL of your website. Our crawler will automatically fetch and process your content.
                </p>
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-background rounded-full p-4 mb-4 border shadow-inner">
                  <Bot className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Customize Your Bot</h3>
                <p className="text-muted-foreground">
                  Define your bot's persona, appearance, and theme to perfectly match your brand's voice.
                </p>
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-background rounded-full p-4 mb-4 border shadow-inner">
                  <Code className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Get Embed Code</h3>
                <p className="text-muted-foreground">
                  Copy a single line of code to add the chat widget to your site. No complex integration needed.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 font-headline">
              A Powerful Platform for Modern AI
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div>{feature.icon}</div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        
        <section id="pricing" className="py-20 md:py-24 bg-card border-y">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 font-headline">Pricing</h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Choose a plan that scales with your needs. Start for free and upgrade anytime.
            </p>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
              {pricingTiers.map((tier) => (
                <Card key={tier.name} className={`flex flex-col ${tier.popular ? 'border-primary shadow-2xl shadow-primary/10' : ''}`}>
                  <CardHeader>
                    {tier.popular && <div className="text-accent font-semibold mb-2">Most Popular</div>}
                    <CardTitle className="font-headline">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="text-4xl font-bold mb-4">
                      {tier.price}
                      {tier.priceUnit && <span className="text-lg font-normal text-muted-foreground">{tier.priceUnit}</span>}
                    </div>
                    <ul className="space-y-3">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-accent" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className={`w-full ${tier.popular ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-primary'}`}>
                      <Link href={tier.href}>{tier.cta}</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
