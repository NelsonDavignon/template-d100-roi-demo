import React, { useEffect } from 'react';
import { SlideProps } from '../types';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const Slide4_Offer: React.FC<SlideProps> = ({ config }) => {
  
  useEffect(() => {
    // Dynamically load Calendly script
    const head = document.querySelector('head');
    const script = document.createElement('script');
    script.setAttribute('src', 'https://assets.calendly.com/assets/external/widget.js');
    head?.appendChild(script);
  }, []);

  const benefits = [
    "First AI Agent Built Free",
    "Zero Setup Fees",
    "Tailored for Construction Workflows"
  ];

  return (
    <div className="flex flex-col lg:flex-row h-full w-full max-w-6xl mx-auto px-6 py-10 items-center gap-10">
      
      {/* Text Content */}
      <motion.div 
        className="flex-1 text-left"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="bg-brand-gold/10 text-brand-gold px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block mb-4">
            Next Steps
        </div>
        <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-white">
          Let's Build The Future of <br/>
          <span className="text-brand-gold">{config.name}</span>
        </h2>
        
        <div className="space-y-4 mb-8">
            {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                    <CheckCircleIcon className="w-6 h-6 text-brand-gold flex-shrink-0" />
                    <span className="text-xl text-gray-200">{benefit}</span>
                </div>
            ))}
        </div>

        <div className="p-6 border border-white/10 rounded-xl bg-white/5 backdrop-blur-sm">
            <p className="text-brand-muted text-sm italic">
                "We don't just build homes, we build legacies." <br/>
                Let AI handle the noise so you can focus on the craft.
            </p>
        </div>
      </motion.div>

      {/* Calendly Embed */}
      <motion.div 
        className="flex-1 w-full h-[600px] bg-brand-card rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
      >
        <div 
            className="calendly-inline-widget w-full h-full" 
            data-url="https://calendly.com/nelson-ndoventures/one-on-one?background_color=1a1a1a&text_color=ffffff&primary_color=d4af37" 
            style={{ minWidth: '320px', height: '100%' }} 
        />
      </motion.div>

    </div>
  );
};

export default Slide4_Offer;