'use client';

import { useState } from 'react';
import { ContactCard } from "@/components/ui/contact-card";
import { MailIcon, PhoneIcon, MapPinIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export function ContactSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      message: formData.get('message'),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to send');

      setSubmitted(true);
      toast({
        title: "Message Sent",
        description: "We'll get back to you within 24 hours.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative w-full py-24 bg-[#0a0a0a] px-6">
      <div className="mx-auto max-w-6xl">
        <ContactCard
          title="Get in touch"
          description="Have questions about NochBot? Want a custom enterprise solution? Our team is ready to help you deploy the future of customer interaction."
          contactInfo={[
            {
              icon: MailIcon,
              label: 'Email',
              value: 'sriyanshgupta24@gmail.com',
            },
            {
              icon: PhoneIcon,
              label: 'Phone',
              value: '+91 6387562920',
            },
            {
              icon: MapPinIcon,
              label: 'Address',
              value: 'Kanpur, UP, India',
              className: 'col-span-2',
            }
          ]}
        >
          {submitted ? (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 w-full h-full">
              <div className="h-16 w-16 rounded-full bg-[#36f4a4]/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-[#36f4a4]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Thank You!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Your message has been sent successfully. We'll be in touch soon.
                </p>
              </div>
              <Button 
                variant="outline" 
                className="mt-4 border-white/10 hover:bg-white/5"
                onClick={() => setSubmitted(false)}
              >
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="flex flex-col gap-2">
                <Label className="text-white/70">Full Name</Label>
                <Input 
                  name="name" 
                  type="text" 
                  placeholder="John Doe"
                  className="bg-black/40 border-white/10 focus:border-[#36f4a4]/50" 
                  required 
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-white/70">Email Address</Label>
                <Input 
                  name="email" 
                  type="email" 
                  placeholder="name@company.com"
                  className="bg-black/40 border-white/10 focus:border-[#36f4a4]/50" 
                  required 
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-white/70">Phone Number</Label>
                <Input 
                  name="phone" 
                  type="tel" 
                  placeholder="+91 00000 00000"
                  className="bg-black/40 border-white/10 focus:border-[#36f4a4]/50" 
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-white/70">Message</Label>
                <Textarea  
                  name="message" 
                  placeholder="How can we help?"
                  className="bg-black/40 border-white/10 focus:border-[#36f4a4]/50 min-h-[120px]" 
                  required 
                />
              </div>
              <Button 
                className="w-full bg-[#36f4a4] hover:bg-[#36f4a4]/90 text-black font-bold h-12" 
                type="submit"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Message'}
              </Button>
            </form>
          )}
        </ContactCard>
      </div>
    </section>
  );
}
