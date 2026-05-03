'use client';
import React from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckIcon, SparklesIcon } from 'lucide-react';
import Link from 'next/link';

type PricingCardProps = {
	titleBadge: string;
	priceLabel: string;
	priceSuffix?: string;
	features: string[];
	cta?: string;
	className?: string;
};

function FilledCheck() {
	return (
		<div className="bg-primary text-primary-foreground rounded-full p-0.5 shrink-0">
			<CheckIcon className="size-3" strokeWidth={3} />
		</div>
	);
}

function PricingCard({
	titleBadge,
	priceLabel,
	priceSuffix = '/month',
	features,
	cta = 'Subscribe',
	className,
}: PricingCardProps) {
	return (
		<div
			className={cn(
				'bg-background border-white/10 relative overflow-hidden rounded-xl border flex flex-col',
				'supports-[backdrop-filter]:bg-background/10 backdrop-blur',
				className,
			)}
		>
			<div className="flex items-center gap-3 p-4">
				<Badge variant="secondary">{titleBadge}</Badge>
				<div className="ml-auto">
					<Button variant="outline" size="sm" asChild>
                        <Link href="/register">{cta}</Link>
                    </Button>
				</div>
			</div>

			<div className="flex items-baseline gap-2 px-4 py-2">
				<span className="font-mono text-4xl font-semibold tracking-tight">
					{priceLabel}
				</span>
				{priceLabel.toLowerCase() !== 'custom' && (
					<span className="text-white/40 text-xs">{priceSuffix}</span>
				)}
			</div>

			<ul className="text-white/40 grid gap-3 p-4 text-[13px] flex-1">
				{features.map((f, i) => (
					<li key={i} className="flex items-start gap-3">
						<FilledCheck />
						<span className="leading-tight">{f}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export function BentoPricing() {
	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-8">
            {/* PRO - Most Popular (Large Bento) */}
			<div
				className={cn(
					'bg-background border-white/10 relative w-full overflow-hidden rounded-xl border',
					'supports-[backdrop-filter]:bg-background/10 backdrop-blur',
					'lg:col-span-5',
				)}
			>
				<div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 h-full w-full [mask-image:linear-gradient(white,transparent)]">
					<div className="from-white/5 to-white/2 absolute inset-0 bg-gradient-to-r [mask-image:radial-gradient(farthest-side_at_top,white,transparent)]">
						<div
							aria-hidden="true"
							className={cn(
								'absolute inset-0 size-full mix-blend-overlay',
								'bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px)]',
								'bg-[size:24px]',
							)}
						/>
					</div>
				</div>
				<div className="flex items-center gap-3 p-4 relative z-10">
					<Badge variant="default" className="bg-primary text-primary-foreground">PRO</Badge>
					<Badge variant="outline" className="hidden lg:flex border-white/10 text-white/60">
						<SparklesIcon className="me-1 size-3 text-primary" /> Most Recommended
					</Badge>
					<div className="ml-auto">
						<Button asChild size="sm">
                            <Link href="/register">Go Pro</Link>
                        </Button>
					</div>
				</div>
				<div className="flex flex-col p-4 lg:flex-row relative z-10">
					<div className="pb-4 lg:w-[35%]">
						<span className="font-mono text-5xl font-semibold tracking-tight">
							₹1,499
						</span>
						<span className="text-white/40 text-sm">/month</span>
                        <p className="text-xs text-white/30 mt-2">For growing products</p>
					</div>
					<ul className="text-white/60 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] lg:w-[65%]">
						{[
							'10 chatbots',
							'10,000 messages/month',
							'Unlimited crawls',
							'RAG vector search',
                            'Analytics dashboard',
                            'Custom bot icon + theme',
                            'Priority support (24h)',
                            'API access'
						].map((f, i) => (
							<li key={i} className="flex items-center gap-3">
								<FilledCheck />
								<span className="leading-relaxed">{f}</span>
							</li>
						))}
					</ul>
				</div>
			</div>

            {/* STARTER */}
			<PricingCard
				titleBadge="STARTER"
				priceLabel="₹499"
				features={[
					'3 chatbots',
					'1,000 messages/month',
					'5 website crawls',
                    'Remove Nocta branding',
                    'Custom bot name + color',
                    'Email support (48h)'
				]}
				className="lg:col-span-3"
                cta="Start Now"
			/>

            {/* FREE */}
			<PricingCard
				titleBadge="FREE"
				priceLabel="₹0"
				features={[
					'1 chatbot',
					'100 messages/month',
					'1 website crawl',
                    'Nocta branding on widget',
                    'Community support'
				]}
				className="lg:col-span-4"
                cta="Try Free"
			/>

            {/* ENTERPRISE */}
			<PricingCard
				titleBadge="ENTERPRISE"
				priceLabel="Custom"
				features={[
					'Unlimited chatbots & messages',
					'Dedicated Qdrant cluster',
					'On-premise option',
                    'SSO + SAML auth',
                    'Dedicated success manager',
                    'White-label option'
				]}
				className="lg:col-span-4"
                cta="Contact Sales"
			/>
		</div>
	);
}
