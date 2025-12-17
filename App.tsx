import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { CLIENT_CONFIG } from './constants';
import { SlideIndex } from './types';
import Slide1_Problem from './components/Slide1_Problem';
import Slide2_Solution from './components/Slide2_Solution';
import Slide3_ROI from './components/Slide3_ROI';
import Slide_Possibilities from './components/Slide_Possibilities';
import Slide4_Offer from './components/Slide4_Offer';

function App() {
  const [currentSlide, setCurrentSlide] = useState(SlideIndex.PROBLEM);
  const totalSlides = 5;

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  // Render the correct component based on index
  const renderSlide = () => {
    const props = { isActive: true, config: CLIENT_CONFIG };
    
    switch (currentSlide) {
      case SlideIndex.PROBLEM:
        return <Slide1_Problem {...props} />;
      case SlideIndex.SOLUTION:
        return <Slide2_Solution {...props} />;
      case SlideIndex.ROI:
        return <Slide3_ROI {...props} />;
      case SlideIndex.POSSIBILITIES:
        return <Slide_Possibilities {...props} />;
      case SlideIndex.OFFER:
        return <Slide4_Offer {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative w-screen h-screen bg-brand-dark overflow-hidden flex flex-col">
      
      {/* Header / Logo Area */}
      <div className="absolute top-0 left-0 w-full p-6 z-50 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="text-2xl font-serif font-bold tracking-widest text-white pointer-events-auto">
          {CLIENT_CONFIG.name.toUpperCase()}
        </div>
        <div className="text-xs font-mono text-brand-gold uppercase tracking-widest opacity-80">
          AI Automation Proposal
        </div>
      </div>

      {/* Main Slide Content */}
      <main className="flex-grow relative flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="w-full h-full absolute inset-0 overflow-y-auto"
          >
            {renderSlide()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation Controls */}
      <div className="absolute bottom-0 w-full p-8 z-50 flex justify-between items-center bg-gradient-to-t from-black/90 to-transparent">
        {/* Progress Indicators */}
        <div className="flex gap-2">
          {[...Array(totalSlides)].map((_, idx) => (
            <div 
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentSlide ? 'w-8 bg-brand-gold' : 'w-2 bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button 
            onClick={prevSlide}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors backdrop-blur-md border border-white/10"
            disabled={currentSlide === 0}
            style={{ opacity: currentSlide === 0 ? 0.3 : 1 }}
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <button 
            onClick={nextSlide}
            className="p-3 rounded-full bg-brand-gold hover:bg-yellow-500 text-brand-dark transition-colors shadow-lg shadow-brand-gold/20"
          >
             {currentSlide === totalSlides - 1 ? (
                <span className="text-xs font-bold px-2">FINISH</span>
             ) : (
                <ChevronRightIcon className="w-6 h-6" />
             )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;