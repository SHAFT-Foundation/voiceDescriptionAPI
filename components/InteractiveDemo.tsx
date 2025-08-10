import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileVideo, Image, Upload, Sparkles, Zap, 
  Play, Pause, RotateCw, ChevronRight, 
  Monitor, Smartphone, Tablet, Code2,
  CheckCircle, Clock, Brain, Volume2
} from 'lucide-react';

interface InteractiveDemoProps {
  onStartDemo: (type: 'video' | 'image') => void;
}

export const InteractiveDemo: React.FC<InteractiveDemoProps> = ({ onStartDemo }) => {
  const [selectedType, setSelectedType] = useState<'video' | 'image'>('video');
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isAnimating, setIsAnimating] = useState(false);

  const handleStartDemo = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onStartDemo(selectedType);
      setIsAnimating(false);
    }, 500);
  };

  const demoExamples = {
    video: [
      { 
        title: 'Educational Lecture', 
        duration: '5:23', 
        size: '45 MB',
        thumbnail: '🎓',
        description: 'University physics lecture on quantum mechanics'
      },
      { 
        title: 'Nature Documentary', 
        duration: '3:15', 
        size: '28 MB',
        thumbnail: '🦁',
        description: 'Wildlife scenes from African savanna'
      },
      { 
        title: 'Product Demo', 
        duration: '2:45', 
        size: '22 MB',
        thumbnail: '📱',
        description: 'Smartphone features walkthrough'
      },
      { 
        title: 'Sports Highlights', 
        duration: '4:10', 
        size: '38 MB',
        thumbnail: '⚽',
        description: 'Soccer match best moments'
      },
    ],
    image: [
      { 
        title: 'Infographic', 
        resolution: '1920x1080', 
        size: '2.3 MB',
        thumbnail: '📊',
        description: 'Data visualization chart'
      },
      { 
        title: 'Architecture', 
        resolution: '3840x2160', 
        size: '5.1 MB',
        thumbnail: '🏛️',
        description: 'Modern building exterior'
      },
      { 
        title: 'Medical Scan', 
        resolution: '1024x1024', 
        size: '1.8 MB',
        thumbnail: '🩺',
        description: 'X-ray diagnostic image'
      },
      { 
        title: 'Art Gallery', 
        resolution: '2560x1440', 
        size: '3.7 MB',
        thumbnail: '🎨',
        description: 'Museum exhibition photo'
      },
    ],
  };

  return (
    <div className="relative">
      {/* Interactive Header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full mb-6"
        >
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span className="text-purple-700 font-semibold">Interactive Demo</span>
          <Sparkles className="w-5 h-5 text-blue-600" />
        </motion.div>
        
        <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
          See the Magic in Action
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Choose your content type and watch our AI transform it into comprehensive audio descriptions in real-time.
        </p>
      </div>

      {/* Main Demo Container */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Type Selector */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-1">
            <div className="bg-white rounded-t-2xl p-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedType('video')}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                      selectedType === 'video'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <FileVideo className="w-5 h-5 inline mr-2" />
                    Video Processing
                  </button>
                  <button
                    onClick={() => setSelectedType('image')}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                      selectedType === 'image'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Image className="w-5 h-5 inline mr-2" />
                    Image Processing
                  </button>
                </div>

                {/* Device Preview Selector */}
                <div className="hidden lg:flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setDeviceView('desktop')}
                    className={`p-2 rounded ${deviceView === 'desktop' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <Monitor className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeviceView('tablet')}
                    className={`p-2 rounded ${deviceView === 'tablet' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <Tablet className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeviceView('mobile')}
                    className={`p-2 rounded ${deviceView === 'mobile' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <Smartphone className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Demo Content Area */}
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedType}
                initial={{ opacity: 0, x: selectedType === 'video' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: selectedType === 'video' ? 20 : -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Examples Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {demoExamples[selectedType].map((example, index) => (
                    <motion.div
                      key={example.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02 }}
                      className="bg-gray-50 rounded-xl p-6 cursor-pointer hover:bg-gray-100 transition-all group"
                      onClick={handleStartDemo}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center text-3xl shadow-sm group-hover:shadow-md transition-all">
                          {example.thumbnail}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{example.title}</h3>
                          <p className="text-sm text-gray-600 mb-2">{example.description}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {selectedType === 'video' ? (
                              <>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {example.duration}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="flex items-center gap-1">
                                  <Monitor className="w-3 h-3" />
                                  {(example as any).resolution}
                                </span>
                              </>
                            )}
                            <span>{example.size}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Upload Your Own Section */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur-xl opacity-20" />
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="relative bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white cursor-pointer"
                    onClick={handleStartDemo}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Upload Your Own {selectedType === 'video' ? 'Video' : 'Image'}</h3>
                        <p className="text-white/90 mb-4">
                          Test with your own content and see personalized results
                        </p>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-2">
                            <Zap className="w-5 h-5" />
                            Instant processing
                          </span>
                          <span className="flex items-center gap-2">
                            <Brain className="w-5 h-5" />
                            AI-powered analysis
                          </span>
                          <span className="flex items-center gap-2">
                            <Volume2 className="w-5 h-5" />
                            Natural voice output
                          </span>
                        </div>
                      </div>
                      <motion.div
                        animate={{ 
                          rotate: isAnimating ? 360 : 0,
                          scale: isAnimating ? [1, 1.2, 1] : 1
                        }}
                        transition={{ duration: 0.5 }}
                        className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center"
                      >
                        <Upload className="w-10 h-10 text-white" />
                      </motion.div>
                    </div>
                  </motion.div>
                </div>

                {/* Process Preview */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8 grid grid-cols-4 gap-4"
                >
                  {[
                    { icon: Upload, label: 'Upload', color: 'purple' },
                    { icon: Brain, label: 'Analyze', color: 'blue' },
                    { icon: FileVideo, label: 'Process', color: 'indigo' },
                    { icon: CheckCircle, label: 'Complete', color: 'green' },
                  ].map((step, index) => (
                    <motion.div
                      key={step.label}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="text-center"
                    >
                      <div className={`w-16 h-16 mx-auto bg-${step.color}-100 rounded-xl flex items-center justify-center mb-2`}>
                        <step.icon className={`w-8 h-8 text-${step.color}-600`} />
                      </div>
                      <p className="text-sm font-medium text-gray-700">{step.label}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer CTA */}
          <div className="bg-gray-50 px-8 py-6 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-600">
                  AI models ready • Average processing time: 45 seconds
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStartDemo}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                Start Demo
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating API Code Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-12 max-w-4xl mx-auto"
      >
        <div className="bg-gray-900 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Code2 className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-mono text-gray-400">Quick API Integration</span>
            </div>
            <button className="text-xs px-3 py-1 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors">
              View Full Docs
            </button>
          </div>
          <pre className="text-sm font-mono text-gray-300 overflow-x-auto">
{`// Process ${selectedType} with one API call
const response = await fetch('https://api.voicedescription.ai/process', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
  body: formData
});

const { description, audioUrl } = await response.json();`}
          </pre>
        </div>
      </motion.div>
    </div>
  );
};