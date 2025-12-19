import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { activeConfig } from './config'; // We use the new config now
import { SlideIndex } from './types';

// YOUR IMPORTS (Matched from your screenshot)
import Slide1_Problem from './components/Slide1_Problem';
import Slide2_Solution from './components/Slide2_Solution';
import Slide3_ROI from './components/Slide3_ROI';
import Slide_Possibilities from './components/Slide_Possibilities';
import Slide4_Offer from './components/Slide4_Offer';

function App() {
  // Start at Problem slide
  const [currentSlide, setCurrentSlide] = useState(SlideIndex.PROBLEM);
  
  // Total number of slides (0 to 4 = 5 slides)
  const totalSlides = 5;

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  // Render the correct component based on index
  const renderSlide = () => {
    // We pass "isActive" to Slide 2 so it knows when to wake up
    const props = { isActive: currentSlide === SlideIndex.SOLUTION, config: activeConfig };

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
    <div className="relative w-screen h-[100dvh] bg-black overflow-hidden flex flex-col font-sans selection:bg-yellow-500/30">
      
      {/* HEADER - Locked to top, z-index 50 to stay above everything */}
      <div className="absolute top-0 left-0 w-full p-6 z-50 flex justify-between items-start pointer-events-none bg-gradient-to-b from-black/90 to-transparent h-32">
        <div>
          <h2 className="text-2xl font-serif tracking-wide text-white font-bold leading-none">
            {activeConfig.companyName.split(' ')[0]}
          </h2>
          <h2 className="text-2xl font-serif tracking-wide text-white font-bold leading-none">
            {activeConfig.companyName.split(' ').slice(1).join(' ')}
          </h2>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-xs font-mono text-yellow-500 tracking-widest uppercase">
            AI Automation Proposal
          </p>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {/* FIX 2: pt-24 (Padding Top) pushes content down so it doesn't hit the Logo */}
      {/* FIX 3: overflow-y-auto lets you scroll if the text is too long */}
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
