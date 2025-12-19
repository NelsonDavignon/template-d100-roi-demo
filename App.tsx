import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

// YOUR IMPORTS (Restored from your screenshot)
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

  const renderSlide = () => {
    const props = { isActive: currentSlide === SlideIndex.SOLUTION, config: CLIENT_CONFIG };

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
    // FIX 1: h-[100dvh] fixes the "Jumping Address Bar" on iPhone
    // FIX 2: overflow-hidden stops the page from bouncing
    <div className="relative w-screen h-[100dvh] bg-black overflow-hidden flex flex-col font-sans selection:bg-yellow-500/30">
      
      {/* HEADER - Locked to top */}
      <div className="absolute top-0 left-0 w-full p-6 z-50 flex justify-between items-start pointer-events-none bg-gradient-to-b from-black/90 to-transparent h-32">
        <div>
          {/* Using CLIENT_CONFIG because that is what your file has */}
          <h2 className="text-2xl font-serif tracking-wide text-white font-bold leading-none">
            {CLIENT_CONFIG.companyName ? CLIENT_CONFIG.companyName.split(' ')[0] : 'NDO'}
          </h2>
          <h2 className="text-2xl font-serif tracking-wide text-white font-bold leading-none">
             {CLIENT_CONFIG.companyName && CLIENT_CONFIG.companyName.split(' ').length > 1 
                ? CLIENT_CONFIG.companyName.split(' ').slice(1).join(' ') 
                : 'VENTURES'}
          </h2>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-xs font-mono text-yellow-500 tracking-widest uppercase">
            AI Automation Proposal
          </p>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {/* FIX 3: pt-24 pushes content down so it doesn't overlap the logo */}
      {/* FIX 4: overflow-y-auto enables scrolling for tall content */}
      <div className="flex-1 w-full h-full pt-24 pb-20 overflow-y-auto no-scrollbar relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {renderSlide()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* NAVIGATION BUTTONS (Floating at bottom) */}
      <div className="absolute bottom-6 right-6 flex space-x-2 z-50">
        <button 
          onClick={prevSlide}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md transition-all active:scale-95"
        >
          <ChevronLeftIcon className="w-6 h-6 text-white" />
        </button>
        <button 
          onClick={nextSlide}
          className="p-3 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20 transition-all active:scale-95"
        >
          <ChevronRightIcon className="w-6 h-6" />
        </button>
      </div>

      {/* PROGRESS BAR */}
      <div className="absolute bottom-10 left-6 flex space-x-2 z-40">
        {[...Array(totalSlides)].map((_, i) => (
          <div 
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === currentSlide ? 'w-8 bg-yellow-500' : 'w-2 bg-white/20'
            }`}
          />
        ))}
      </div>

    </div>
  );
}

export default App;
