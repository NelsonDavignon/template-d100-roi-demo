import React, { useState } from 'react';
import { SlideProps } from '../types';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const Slide3_ROI: React.FC<SlideProps> = ({ config }) => {
  const [leads, setLeads] = useState(config.metrics.defaultLeads);
  const [missedRate, setMissedRate] = useState(config.metrics.defaultMissedRate * 100);
  const [jobValue, setJobValue] = useState(config.metrics.avgJobValue);
  const [closeRate, setCloseRate] = useState(config.metrics.defaultCloseRate * 100);

  // Calculations
  const missedLeadCount = Math.round(leads * (missedRate / 100));
  const lostRevenue = missedLeadCount * jobValue * (closeRate / 100);
  
  // AI Recovery (Assuming 70% capture of previously missed calls + 21x speed to lead factor improving close rate slightly)
  // Simplified logic: Recover 80% of missed revenue
  const recoveredRevenue = lostRevenue * 0.8; 

  const data = [
    { name: 'Revenue Lost', value: lostRevenue, color: '#ef4444' }, // Red
    { name: 'AI Recovery', value: recoveredRevenue, color: '#22c55e' }, // Green
  ];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="flex flex-col h-full px-4 md:px-12 py-8 max-w-6xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-8"
      >
        <div className="bg-brand-gold/10 text-brand-gold px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block mb-2">
            The Economics
        </div>
        <h2 className="text-3xl md:text-4xl font-serif font-bold">The Cost of Missed Calls</h2>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-full">
        {/* Controls */}
        <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-8 bg-brand-card p-6 rounded-2xl border border-white/5"
        >
          {/* Monthly Leads */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-brand-muted text-sm uppercase tracking-wide">Monthly Leads</label>
              <span className="font-bold text-brand-text">{leads}</span>
            </div>
            <input 
              type="range" min="10" max="200" value={leads} 
              onChange={(e) => setLeads(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-gold"
            />
          </div>

          {/* Missed Call Rate */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-brand-muted text-sm uppercase tracking-wide">Missed Call Rate (%)</label>
              <span className="font-bold text-red-400">{missedRate}%</span>
            </div>
            <input 
              type="range" min="0" max="80" value={missedRate} 
              onChange={(e) => setMissedRate(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-400"
            />
            <p className="text-xs text-gray-500 mt-1">Industry Average: 30-40%</p>
          </div>

           {/* Avg Job Value */}
           <div>
            <div className="flex justify-between mb-2">
              <label className="text-brand-muted text-sm uppercase tracking-wide">Avg Job Value</label>
              <span className="font-bold text-brand-text">{formatCurrency(jobValue)}</span>
            </div>
            <input 
              type="range" min="10000" max="500000" step="5000" value={jobValue} 
              onChange={(e) => setJobValue(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-gold"
            />
          </div>

          {/* Close Rate */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-brand-muted text-sm uppercase tracking-wide">Close Rate (%)</label>
              <span className="font-bold text-brand-text">{closeRate}%</span>
            </div>
            <input 
              type="range" min="1" max="50" value={closeRate} 
              onChange={(e) => setCloseRate(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-gold"
            />
          </div>
        </motion.div>

        {/* Visuals */}
        <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col justify-center"
        >
            <div className="h-64 w-full mb-8">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} stroke="#a1a1aa" fontSize={12} />
                        <Tooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid #333', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => formatCurrency(value)}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-gradient-to-r from-brand-card to-transparent border-l-4 border-brand-gold p-6 rounded-r-xl">
                <h3 className="text-xl font-bold mb-2 text-white">The Opportunity</h3>
                <p className="text-brand-muted mb-4">
                    By answering instantly, you stop leakage. By following the "5-Minute Rule", qualification rates skyrocket 21x.
                </p>
                <div className="text-3xl font-serif font-bold text-green-400">
                    {formatCurrency(recoveredRevenue)} <span className="text-sm font-sans font-normal text-gray-400">/mo Potential Lift</span>
                </div>
            </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Slide3_ROI;
