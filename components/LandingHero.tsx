import React from 'react';
import { motion } from 'framer-motion';
import { Play, Accessibility, Volume2, Eye, ArrowRight, CheckCircle } from 'lucide-react';

interface LandingHeroProps {
  onGetStarted: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onGetStarted }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                AI-Powered Accessibility
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full">
                WCAG 2.1 Compliant
              </span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Making Visual Content{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Accessible to All
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Transform videos and images into comprehensive audio descriptions using cutting-edge AI. 
              Empower visually impaired audiences with rich, contextual narration.
            </p>

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="text-3xl font-bold text-gray-900">285M+</div>
                <div className="text-sm text-gray-600">People with visual impairments worldwide</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="text-3xl font-bold text-gray-900">98%</div>
                <div className="text-sm text-gray-600">Accuracy in scene detection</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="text-3xl font-bold text-gray-900">&lt;2min</div>
                <div className="text-sm text-gray-600">Average processing time</div>
              </motion.div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onGetStarted}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                Try It Now - Free
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="/docs"
                className="px-8 py-4 bg-white text-gray-700 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 border border-gray-200"
              >
                View API Docs
                <Play className="w-5 h-5" />
              </motion.a>
            </div>
          </motion.div>

          {/* Right column - Visual Demo */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-1">
              <div className="rounded-xl overflow-hidden bg-gray-900">
                {/* Demo Preview */}
                <div className="aspect-video relative bg-gradient-to-br from-gray-800 to-gray-900">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center"
                      >
                        <Play className="w-8 h-8 text-white ml-1" />
                      </motion.div>
                      <p className="text-white font-medium">Interactive Demo</p>
                    </div>
                  </div>

                  {/* Feature badges */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="absolute top-4 left-4 flex gap-2"
                  >
                    <span className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Live
                    </span>
                  </motion.div>

                  {/* Process flow visualization */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-black/50 backdrop-blur-md rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-300">Processing Pipeline</span>
                        <span className="text-xs text-green-400">Active</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 h-1 bg-green-500 rounded-full" />
                        <div className="flex-1 h-1 bg-green-500 rounded-full" />
                        <div className="flex-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                        <div className="flex-1 h-1 bg-gray-600 rounded-full" />
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] text-gray-400">
                        <span>Upload</span>
                        <span>Analyze</span>
                        <span>Generate</span>
                        <span>Deliver</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature highlights */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="absolute -bottom-6 -right-6 bg-white rounded-lg shadow-xl p-4 max-w-[200px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Volume2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Natural Voice</p>
                  <p className="text-xs text-gray-600">30+ languages supported</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="absolute -top-6 -left-6 bg-white rounded-lg shadow-xl p-4 max-w-[200px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">AI Vision</p>
                  <p className="text-xs text-gray-600">Powered by AWS AI</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};