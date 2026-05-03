'use client';

import { BentoPricing } from "@/components/ui/bento-pricing";
import { cn } from '@/lib/utils';

export function Pricing() {
 return (
		<section id="pricing" className="relative flex w-full flex-col items-center justify-center border-t border-white/5 bg-[#080b10] py-24 md:py-32">
			{/* Dots Background */}
			<div
				aria-hidden="true"
				className={cn(
					'absolute inset-0 -z-10 size-full',
					'bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)]',
					'bg-[size:24px_24px]',
				)}
			/>

			<div className="mx-auto w-full max-w-5xl px-6">
				{/* Heading */}
				<div className="mx-auto mb-16 max-w-2xl text-center">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-4">Pricing</p>
					<h2 className="text-[clamp(2.5rem,5vw,4rem)] font-normal tracking-tight text-white leading-tight">
						Scale with <span className="text-primary italic">NOCTA</span>
					</h2>
					<p className="text-white/40 mt-6 text-sm md:text-base leading-relaxed">
						Stop using rigid, expensive tools. We built our pricing around modern teams, 
                        so you can focus on building intelligent user experiences.
					</p>
				</div>
				<BentoPricing />
			</div>
		</section>
	);
}
