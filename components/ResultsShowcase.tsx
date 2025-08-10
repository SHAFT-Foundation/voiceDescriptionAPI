import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Headphones, Download, Copy, Check, 
  Play, Pause, Volume2, Clock, Globe, Hash,
  BarChart, TrendingUp, Sparkles, Award
} from 'lucide-react';

interface ResultsShowcaseProps {
  jobId: string;
  type: 'video' | 'image';
  results?: {
    description: string;
    audioUrl?: string;
    metadata?: {
      language: string;
      duration: string;
      wordCount: number;
      scenes?: number;
      confidence: number;
    };
  };
}

export const ResultsShowcase: React.FC<ResultsShowcaseProps> = ({ 
  jobId, 
  type, 
  results = {
    description: "A serene mountain landscape unfolds before the viewer, with snow-capped peaks piercing through a sea of clouds. The early morning sun casts a golden glow across the scene, illuminating the rocky terrain and creating dramatic shadows. In the foreground, a crystal-clear alpine lake reflects the majestic mountains, its surface disturbed only by gentle ripples. Pine trees frame the composition, their dark silhouettes contrasting against the bright sky. This breathtaking vista captures the raw beauty and tranquility of nature at its finest.",
    audioUrl: "/sample-audio.mp3",
    metadata: {
      language: "English",
      duration: "45 seconds",
      wordCount: 89,
      scenes: 5,
      confidence: 98.5
    }
  }
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'audio' | 'stats'>('text');
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleCopy = () => {
    if (results?.description) {
      navigator.clipboard.writeText(results.description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = (format: 'txt' | 'srt' | 'vtt') => {
    // Simulate download
    const blob = new Blob([results?.description || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `description.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto"
    >
      {/* Success Banner */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-6 mb-8 text-white"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Processing Complete!</h2>
              <p className="text-white/90">Your {type} has been successfully analyzed and described.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-8 h-8" />
            <span className="text-3xl font-bold">{results?.metadata?.confidence}%</span>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'text', label: 'Description', icon: FileText },
              { id: 'audio', label: 'Audio', icon: Headphones },
              { id: 'stats', label: 'Analytics', icon: BarChart },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* Text Description Tab */}
          {activeTab === 'text' && (
            <motion.div
              key="text"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-8"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Generated Description</h3>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopy}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-all"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </motion.button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {results?.description}
                </p>
              </div>

              {/* Metadata Pills */}
              <div className="flex flex-wrap gap-3 mb-6">
                <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {results?.metadata?.language}
                </span>
                <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {results?.metadata?.duration}
                </span>
                <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  {results?.metadata?.wordCount} words
                </span>
                {results?.metadata?.scenes && (
                  <span className="px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {results.metadata.scenes} scenes
                  </span>
                )}
              </div>

              {/* Download Options */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Download Formats</h4>
                <div className="flex gap-3">
                  {['txt', 'srt', 'vtt'].map((format) => (
                    <motion.button
                      key={format}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDownload(format as any)}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      .{format.toUpperCase()}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <motion.div
              key="audio"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-8"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Audio Narration</h3>
                <p className="text-gray-600">Natural voice synthesis powered by Amazon Polly</p>
              </div>

              {/* Audio Player */}
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-14 h-14 bg-white/20 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/30 transition-all"
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                    </button>
                    <div>
                      <p className="font-semibold">Audio Description</p>
                      <p className="text-sm text-white/80">Voice: Joanna (Female)</p>
                    </div>
                  </div>
                  <Volume2 className="w-6 h-6" />
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: isPlaying ? '100%' : '0%' }}
                      transition={{ duration: 45, ease: 'linear' }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-white/80">
                    <span>0:00</span>
                    <span>{results?.metadata?.duration}</span>
                  </div>
                </div>
              </div>

              {/* Audio Settings */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Format</p>
                  <p className="font-semibold">MP3 320kbps</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Size</p>
                  <p className="font-semibold">2.3 MB</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full mt-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Audio File
              </motion.button>
            </motion.div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-8"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Processing Analytics</h3>
                <p className="text-gray-600">Detailed insights about your content analysis</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Confidence Score', value: `${results?.metadata?.confidence}%`, color: 'green' },
                  { label: 'Processing Time', value: '1.8s', color: 'blue' },
                  { label: 'Word Count', value: results?.metadata?.wordCount, color: 'purple' },
                  { label: 'Scenes Analyzed', value: results?.metadata?.scenes || 1, color: 'orange' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">{stat.label}</p>
                    <p className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Performance Chart */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">Performance Metrics</h4>
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div className="space-y-3">
                  {[
                    { metric: 'Scene Detection', value: 98 },
                    { metric: 'Context Understanding', value: 96 },
                    { metric: 'Description Quality', value: 99 },
                    { metric: 'Audio Clarity', value: 100 },
                  ].map((item) => (
                    <div key={item.metric}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{item.metric}</span>
                        <span className="font-semibold">{item.value}%</span>
                      </div>
                      <div className="h-2 bg-white rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.value}%` }}
                          transition={{ duration: 1, delay: 0.1 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};