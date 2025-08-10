import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { 
  Download, FileText, Volume2, Copy, Check, 
  PlayCircle, PauseCircle, SkipBack, SkipForward,
  FileAudio, FileJson, Clock, Calendar, Hash,
  Headphones, Globe, Zap, ChevronDown, ExternalLink
} from 'lucide-react';

interface EnhancedResultsDisplayProps {
  jobId: string;
  jobType: 'video' | 'image';
  results?: any;
}

interface TranscriptSegment {
  timestamp: string;
  text: string;
  confidence?: number;
}

export const EnhancedResultsDisplay: React.FC<EnhancedResultsDisplayProps> = ({
  jobId,
  jobType,
  results,
}) => {
  const [activeTab, setActiveTab] = useState('description');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  const audioRef = useRef<HTMLAudioElement>(null);

  // Audio player controls
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setVolume(vol);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = async (type: 'text' | 'audio' | 'json', filename: string) => {
    setDownloadProgress({ ...downloadProgress, [type]: 0 });
    
    try {
      // Simulate download progress
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => ({
          ...prev,
          [type]: Math.min((prev[type] || 0) + 20, 90)
        }));
      }, 200);

      const endpoint = jobType === 'image'
        ? `/api/results/image/${jobId}/${type}`
        : `/api/results/${jobId}/${type}`;

      const response = await fetch(endpoint);
      const blob = await response.blob();
      
      clearInterval(progressInterval);
      setDownloadProgress({ ...downloadProgress, [type]: 100 });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => {
        setDownloadProgress(prev => {
          const updated = { ...prev };
          delete updated[type];
          return updated;
        });
      }, 1000);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadProgress(prev => {
        const updated = { ...prev };
        delete updated[type];
        return updated;
      });
    }
  };

  // Mock transcript data for demo
  const mockTranscript: TranscriptSegment[] = [
    { timestamp: '00:00', text: 'Opening scene shows a modern office environment with natural lighting.', confidence: 0.98 },
    { timestamp: '00:05', text: 'A person enters the frame from the left, wearing professional attire.', confidence: 0.95 },
    { timestamp: '00:10', text: 'The camera pans across multiple workstations showing collaborative work.', confidence: 0.97 },
    { timestamp: '00:15', text: 'Close-up of computer screens displaying data visualizations and charts.', confidence: 0.96 },
    { timestamp: '00:20', text: 'Team meeting in progress with participants engaged in discussion.', confidence: 0.94 },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Results Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Results Ready</h2>
            <p className="text-sm text-gray-600 mt-1">
              Your {jobType} has been successfully processed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full flex items-center gap-1">
              <Check className="w-4 h-4" />
              Complete
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Clock className="w-6 h-6 text-gray-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">2:34</p>
            <p className="text-xs text-gray-600">Duration</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Hash className="w-6 h-6 text-gray-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">
              {jobType === 'video' ? '12' : '1'}
            </p>
            <p className="text-xs text-gray-600">Scenes</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Globe className="w-6 h-6 text-gray-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">EN</p>
            <p className="text-xs text-gray-600">Language</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Zap className="w-6 h-6 text-gray-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-gray-900">98%</p>
            <p className="text-xs text-gray-600">Confidence</p>
          </div>
        </div>
      </div>

      {/* Audio Player */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-xl shadow-lg p-6 text-white"
      >
        <div className="flex items-center gap-4 mb-4">
          <Headphones className="w-8 h-8" />
          <div>
            <h3 className="text-lg font-semibold">Audio Narration</h3>
            <p className="text-sm opacity-80">Generated with Amazon Polly</p>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="space-y-4">
          {/* Main Controls */}
          <div className="flex items-center justify-center gap-4">
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <SkipBack className="w-6 h-6" />
            </button>
            <button
              onClick={togglePlayPause}
              className="p-4 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              {isPlaying ? (
                <PauseCircle className="w-10 h-10" />
              ) : (
                <PlayCircle className="w-10 h-10" />
              )}
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <SkipForward className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, white ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%)`
              }}
            />
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`
              }}
            />
          </div>
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={`/api/results/${jobId}/audio`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      </motion.div>

      {/* Tabbed Content */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Tabs.List className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          <Tabs.Trigger
            value="description"
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'description'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Description
          </Tabs.Trigger>
          <Tabs.Trigger
            value="transcript"
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'transcript'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileAudio className="w-4 h-4 inline mr-2" />
            Transcript
          </Tabs.Trigger>
          <Tabs.Trigger
            value="metadata"
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'metadata'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileJson className="w-4 h-4 inline mr-2" />
            Metadata
          </Tabs.Trigger>
        </Tabs.List>

        {/* Tab Content */}
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <Tabs.Content value="description" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Generated Description</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(results?.description || 'Sample description text...', 'description')}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  {copied === 'description' ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied === 'description' ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => handleDownload('text', `description_${jobId}.txt`)}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  {downloadProgress.text !== undefined ? `${downloadProgress.text}%` : 'Download'}
                </button>
              </div>
            </div>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed">
                {results?.description || `This ${jobType} contains rich visual content that has been analyzed and described for accessibility. The AI-generated description provides comprehensive details about the visual elements, actions, and context to ensure full understanding for visually impaired users.`}
              </p>
            </div>
          </Tabs.Content>

          <Tabs.Content value="transcript" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Time-Synced Transcript</h3>
              <button
                onClick={() => handleDownload('text', `transcript_${jobId}.srt`)}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Download SRT
              </button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {mockTranscript.map((segment, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="text-sm font-mono text-gray-500 w-16">
                    {segment.timestamp}
                  </span>
                  <div className="flex-1">
                    <p className="text-gray-700">{segment.text}</p>
                    {segment.confidence && (
                      <span className="text-xs text-gray-500">
                        Confidence: {Math.round(segment.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </Tabs.Content>

          <Tabs.Content value="metadata" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Processing Metadata</h3>
              <button
                onClick={() => handleDownload('json', `metadata_${jobId}.json`)}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-300 font-mono">
{JSON.stringify({
  jobId,
  type: jobType,
  status: 'completed',
  timestamp: new Date().toISOString(),
  processing: {
    duration: '2m 34s',
    segments: jobType === 'video' ? 12 : 1,
    confidence: 0.98,
  },
  aws: {
    rekognition: jobType === 'video' ? 'completed' : 'N/A',
    bedrock: 'completed',
    polly: 'completed',
  },
  output: {
    text: `description_${jobId}.txt`,
    audio: `narration_${jobId}.mp3`,
    transcript: `transcript_${jobId}.srt`,
  },
}, null, 2)}
              </pre>
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>

      {/* Download All Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center"
      >
        <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2">
          <Download className="w-5 h-5" />
          Download All Results
        </button>
      </motion.div>
    </div>
  );
};