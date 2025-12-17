import React from 'react';
import { SlideProps } from '../types';
import { motion } from 'framer-motion';
import { 
  SparklesIcon, 
  ChatBubbleLeftRightIcon, 
  EnvelopeIcon, 
  UserPlusIcon, 
  WrenchScrewdriverIcon, 
  CpuChipIcon 
} from '@heroicons/react/24/outline';

const Slide_Possibilities: React.FC<SlideProps> = ({ config }) => {
  const capabilities = [
    { icon: ChatBubbleLeftRightIcon, title: "24/7 Receptionist", desc: "Intelligent call routing & FAQ handling." },
    { icon: UserPlusIcon, title: "Lead Nurture", desc: "Long-term follow-up to convert cold leads." },
    { icon: EnvelopeIcon, title: "Multi-Channel", desc: "Seamless SMS & Email integration." },
    { icon: WrenchScrewdriverIcon, title: "Support & Dispatch", desc: "Ticket creation and field team coordination." },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 max-w-6xl mx-auto text-center">
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="mb-12"
      >
        <div className="bg-brand-gold/10 text-brand-gold px-4 py-1 rounded-full text-sm font-semibold uppercase tracking-wider mb-6 inline-block">
          Beyond The Demo
        </div>
        <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-brand-text">
          Precision Tailored to <br />
          <span className="text-brand-gold">Your Business DNA</span>
        </h2>
        <p className="text-xl text-brand-muted max-w-3xl mx-auto leading-relaxed">
          This demo is just a sketch of what's possible. Your production agent will be 
          <span className="text-white font-semibold"> trained on your specific calls</span>, pricing models, and objection handlers, 
          delivering a level of realism and quality far beyond standard capabilities.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        
        {/* Left Side: The Quality Promise */}
        <motion.div 
            className="bg-brand-card/50 border border-brand-gold/20 rounded-3xl p-8 text-left relative overflow-hidden"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
        >
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <SparklesIcon className="w-24 h-24 text-brand-gold" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <CpuChipIcon className="w-6 h-6 text-brand-gold" />
                The Custom Advantage
             </h3>
             <p className="text-gray-400 mb-6">
                We don't do "one-size-fits-all." We build a bespoke neural architecture for {config.name}.
             </p>
             <ul className="space-y-4 text-gray-300">
                <li className="flex items-start gap-3">
                    <span className="text-brand-gold mt-1">✓</span>
                    <span>Trained on <strong>your</strong> historical best sales calls.</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-brand-gold mt-1">✓</span>
                    <span>Deep integration with your CRM & Calendar.</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-brand-gold mt-1">✓</span>
                    <span>Hyper-realistic voice cloning & latency optimization.</span>
                </li>
                <li className="flex items-start gap-3">
                    <span className="text-brand-gold mt-1">✓</span>
                    <span><strong>Universal Capture:</strong> No matter where leads come from (Phone, Forms, SEO), we contact them instantly.</span>
                </li>
             </ul>
        </motion.div>

        {/* Right Side: The Ecosystem */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {capabilities.map((item, index) => (
                <motion.div 
                    key={index}
                    className="bg-white/5 border border-white/5 hover:border-brand-gold/30 rounded-2xl p-6 text-left transition-colors duration-300"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 + (index * 0.1) }}
                >
                    <item.icon className="w-8 h-8 text-brand-gold mb-3" />
                    <h4 className="text-lg font-bold text-white mb-1">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                </motion.div>
            ))}
        </div>

      </div>
    </div>
  );
};

export default Slide_Possibilities;