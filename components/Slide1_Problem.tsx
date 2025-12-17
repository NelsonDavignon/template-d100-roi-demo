import React from 'react';
import { SlideProps } from '../types';
import { motion } from 'framer-motion';
import { ClockIcon, XCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';

const Slide1_Problem: React.FC<SlideProps> = () => {
  const problems = [
    { icon: UserGroupIcon, text: "Overwhelmed front desk staff" },
    { icon: ClockIcon, text: "Leads calling while you're on site" },
    { icon: XCircleIcon, text: "The After-hours voicemail graveyard" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 max-w-5xl mx-auto text-center">
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="text-5xl md:text-7xl font-serif font-bold text-brand-text mb-4">
          The <span className="text-red-500">5-Minute</span> Rule
        </h1>
        <p className="text-xl md:text-2xl text-brand-muted mb-12">
          Speed to lead isn't just a metric. It's survival.
        </p>
      </motion.div>

      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        {/* Stat Card */}
        <div className="bg-brand-card border border-brand-gold/20 p-8 rounded-3xl shadow-lg shadow-brand-gold/5">
            <div className="text-8xl font-bold text-brand-gold mb-2">21x</div>
            <p className="text-gray-300 text-lg">
                Leads contacted within <span className="font-bold text-white">5 minutes</span> are 21x more likely to qualify.
            </p>
        </div>

        {/* Reality Check List */}
        <div className="text-left space-y-6">
            <h3 className="text-2xl font-bold text-white border-b border-white/10 pb-4">
                The Reality Check
            </h3>
            {problems.map((item, index) => (
                <motion.div 
                    key={index}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.8 + (index * 0.2) }}
                    className="flex items-center gap-4 text-gray-400"
                >
                    <item.icon className="w-8 h-8 text-red-400" />
                    <span className="text-xl">{item.text}</span>
                </motion.div>
            ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Slide1_Problem;
