import React, { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Play, Settings, Code, TestTube, BarChart3, 
  FileVideo, Image, Mic, Download, Globe, Shield, 
  Zap, CheckCircle, AlertCircle, Info, ArrowRight
} from 'lucide-react';

// Import components
import { FileUploader } from '../components/FileUploader';
import { ProcessingDashboard } from '../components/ProcessingDashboard';
import { EnhancedResultsDisplay } from '../components/EnhancedResultsDisplay';
import { LandingHero } from '../components/LandingHero';
import { FeaturesShowcase } from '../components/FeaturesShowcase';

// Import API client
import apiClient, { queryClient, useJobStatus, useAWSStatus, ProcessingOptions } from '../lib/apiClient';

type ViewMode = 'landing' | 'upload' | 'processing' | 'results' | 'api-docs' | 'developer';

interface ProcessingJob {
  jobId: string;
  type: 'video' | 'image';
  fileName: string;
  startTime: Date;
  status: string;
  progress: number;
}

export default function EnhancedHome() {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
  const [processingHistory, setProcessingHistory] = useState<ProcessingJob[]>([]);
  const [showDevTools, setShowDevTools] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'test' | 'api' | 'history'>('test');

  // Query hooks
  const { data: awsStatus } = useQuery({
    queryKey: ['awsStatus'],
    queryFn: () => apiClient.getAWSStatus(),
    refetchInterval: 30000,
  });

  const { data: healthStatus } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealthStatus(),
    refetchInterval: 60000,
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, type, options }: { 
      file: File; 
      type: 'video' | 'image'; 
      options: ProcessingOptions 
    }) => {
      return apiClient.uploadWithProgress(
        file,
        type,
        options,
        (progress) => {
          if (currentJob) {
            setCurrentJob({ ...currentJob, progress });
          }
        }
      );
    },
    onSuccess: (data, variables) => {
      const newJob: ProcessingJob = {
        jobId: data.jobId,
        type: variables.type,
        fileName: variables.file.name,
        startTime: new Date(),
        status: 'processing',
        progress: 0,
      };
      setCurrentJob(newJob);
      setProcessingHistory(prev => [newJob, ...prev]);
      setViewMode('processing');
    },
    onError: (error) => {
      console.error('Upload failed:', error);
    },
  });

  // Handle file upload
  const handleFileUpload = async (file: File, type: 'video' | 'image', metadata: any) => {
    await uploadMutation.mutateAsync({ file, type, options: metadata });
  };

  // Handle processing completion
  const handleProcessingComplete = useCallback((results: any) => {
    if (currentJob) {
      setCurrentJob({ ...currentJob, status: 'completed', progress: 100 });
    }
    setViewMode('results');
  }, [currentJob]);

  // Handle processing error
  const handleProcessingError = useCallback((error: any) => {
    if (currentJob) {
      setCurrentJob({ ...currentJob, status: 'failed' });
    }
    console.error('Processing error:', error);
  }, [currentJob]);

  // Copy code snippet
  const copyCodeSnippet = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  // Download sample files
  const downloadSampleFile = (type: 'video' | 'image') => {
    const url = type === 'video' 
      ? '/samples/sample-video.mp4'
      : '/samples/sample-image.jpg';
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-${type}.${type === 'video' ? 'mp4' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <title>Voice Description API - AI-Powered Accessibility Testing Tool</title>
        <meta name="description" content="Comprehensive testing interface for video and image accessibility description generation" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        {/* Enhanced Header with Navigation */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div 
                  className="cursor-pointer"
                  onClick={() => setViewMode('landing')}
                >
                  <h1 className="text-2xl font-bold text-gray-900">Voice Description API</h1>
                  <p className="text-xs text-gray-500">Testing & Development Interface</p>
                </div>
                
                {/* Navigation Tabs */}
                <nav className="hidden md:flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('landing')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'landing' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Home
                  </button>
                  <button
                    onClick={() => setViewMode('upload')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'upload' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Test Upload
                  </button>
                  <button
                    onClick={() => setViewMode('api-docs')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'api-docs' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    API Docs
                  </button>
                  <button
                    onClick={() => setViewMode('developer')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'developer' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Developer
                  </button>
                </nav>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center gap-4">
                {/* AWS Status Badge */}
                {awsStatus && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${
                      awsStatus.overall?.status === 'all_connected' ? 'bg-green-500' :
                      awsStatus.overall?.status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                    } animate-pulse`} />
                    <span className="text-xs font-medium text-gray-600">
                      AWS: {awsStatus.overall?.connectedServices || 'Checking...'}
                    </span>
                  </div>
                )}

                {/* API Health Badge */}
                {healthStatus && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                    <Shield className={`w-4 h-4 ${
                      healthStatus.status === 'healthy' ? 'text-green-600' : 'text-red-600'
                    }`} />
                    <span className="text-xs font-medium text-gray-600">
                      API {healthStatus.status || 'Unknown'}
                    </span>
                  </div>
                )}

                {/* Developer Tools Toggle */}
                <button
                  onClick={() => setShowDevTools(!showDevTools)}
                  className={`p-2 rounded-lg transition-colors ${
                    showDevTools 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Code className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {/* Landing View */}
            {viewMode === 'landing' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <LandingHero onGetStarted={() => setViewMode('upload')} />
                <FeaturesShowcase />
                
                {/* Quick Start Section */}
                <section className="mt-20 grid md:grid-cols-2 gap-8">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
                  >
                    <FileVideo className="w-12 h-12 text-blue-600 mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Test Video Processing</h3>
                    <p className="text-gray-600 mb-6">
                      Upload a video file to see how our AI generates comprehensive audio descriptions 
                      with scene detection and natural narration.
                    </p>
                    <button
                      onClick={() => {
                        setViewMode('upload');
                        setSelectedTab('test');
                      }}
                      className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      Upload Video
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
                  >
                    <Image className="w-12 h-12 text-green-600 mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Test Image Processing</h3>
                    <p className="text-gray-600 mb-6">
                      Upload images to generate detailed alt text descriptions and audio narration 
                      for improved accessibility and SEO.
                    </p>
                    <button
                      onClick={() => {
                        setViewMode('upload');
                        setSelectedTab('test');
                      }}
                      className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      Upload Image
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                </section>
              </motion.div>
            )}

            {/* Upload View */}
            {viewMode === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid lg:grid-cols-3 gap-8"
              >
                {/* Main Upload Area */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload & Test</h2>
                    <FileUploader
                      onUpload={handleFileUpload}
                      acceptVideo={true}
                      acceptImage={true}
                      maxSize={500 * 1024 * 1024}
                    />
                  </div>

                  {/* Sample Files */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Sample Files</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => downloadSampleFile('video')}
                        className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-center"
                      >
                        <FileVideo className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-900">Sample Video</p>
                        <p className="text-xs text-gray-600">2-minute demo clip</p>
                      </button>
                      <button
                        onClick={() => downloadSampleFile('image')}
                        className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-center"
                      >
                        <Image className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-900">Sample Image</p>
                        <p className="text-xs text-gray-600">High-res test image</p>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Processing History Sidebar */}
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h3>
                    {processingHistory.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {processingHistory.map((job) => (
                          <div
                            key={job.jobId}
                            className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => {
                              setCurrentJob(job);
                              setViewMode(job.status === 'completed' ? 'results' : 'processing');
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {job.type === 'video' ? (
                                  <FileVideo className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Image className="w-4 h-4 text-green-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                                  {job.fileName}
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                job.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {job.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(job.startTime).toLocaleTimeString()}
                            </p>
                            {job.status === 'processing' && (
                              <div className="mt-2">
                                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500"
                                    style={{ width: `${job.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No processing history yet
                      </p>
                    )}
                  </div>

                  {/* API Status */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h3>
                    {awsStatus?.services && (
                      <div className="space-y-3">
                        {Object.entries(awsStatus.services).map(([service, info]: [string, any]) => (
                          <div key={service} className="flex items-center justify-between">
                            <span className="text-sm font-medium capitalize">{service}</span>
                            <div className={`px-2 py-1 text-xs rounded-full ${
                              info.status === 'connected' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {info.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Processing View */}
            {viewMode === 'processing' && currentJob && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ProcessingDashboard
                  jobId={currentJob.jobId}
                  jobType={currentJob.type}
                  onComplete={handleProcessingComplete}
                  onError={handleProcessingError}
                />
              </motion.div>
            )}

            {/* Results View */}
            {viewMode === 'results' && currentJob && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <EnhancedResultsDisplay
                  jobId={currentJob.jobId}
                  jobType={currentJob.type}
                />
                
                {/* Action Buttons */}
                <div className="mt-8 flex justify-center gap-4">
                  <button
                    onClick={() => setViewMode('upload')}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    Process Another File
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('api-docs')}
                    className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    View API Documentation
                  </button>
                </div>
              </motion.div>
            )}

            {/* API Documentation View */}
            {viewMode === 'api-docs' && (
              <motion.div
                key="api-docs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">API Documentation</h2>
                  
                  {/* API Endpoints */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">Endpoints</h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">POST</span>
                            <code className="text-sm font-mono text-gray-900">/api/upload</code>
                          </div>
                          <p className="text-sm text-gray-600">Upload video or image for processing</p>
                        </div>
                        
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">POST</span>
                            <code className="text-sm font-mono text-gray-900">/api/process-image</code>
                          </div>
                          <p className="text-sm text-gray-600">Process single image directly</p>
                        </div>
                        
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">POST</span>
                            <code className="text-sm font-mono text-gray-900">/api/process-images-batch</code>
                          </div>
                          <p className="text-sm text-gray-600">Process multiple images in batch</p>
                        </div>
                        
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">GET</span>
                            <code className="text-sm font-mono text-gray-900">/api/status/[jobId]</code>
                          </div>
                          <p className="text-sm text-gray-600">Get job processing status</p>
                        </div>
                        
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">GET</span>
                            <code className="text-sm font-mono text-gray-900">/api/results/[jobId]/text</code>
                          </div>
                          <p className="text-sm text-gray-600">Download text description</p>
                        </div>
                        
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">GET</span>
                            <code className="text-sm font-mono text-gray-900">/api/results/[jobId]/audio</code>
                          </div>
                          <p className="text-sm text-gray-600">Download audio narration</p>
                        </div>
                      </div>
                    </div>

                    {/* Code Examples */}
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-4">Code Examples</h3>
                      <div className="space-y-4">
                        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-400">JavaScript / TypeScript</span>
                            <button
                              onClick={() => copyCodeSnippet(`const formData = new FormData();
formData.append('file', videoFile);
formData.append('type', 'video');
formData.append('language', 'en');
formData.append('detailLevel', 'detailed');

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});

const { jobId } = await response.json();`)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="text-sm text-gray-300 font-mono">{`const formData = new FormData();
formData.append('file', videoFile);
formData.append('type', 'video');
formData.append('language', 'en');
formData.append('detailLevel', 'detailed');

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});

const { jobId } = await response.json();`}</pre>
                        </div>

                        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-400">Python</span>
                            <button
                              onClick={() => copyCodeSnippet(`import requests

files = {'file': open('video.mp4', 'rb')}
data = {
    'type': 'video',
    'language': 'en',
    'detailLevel': 'detailed'
}

response = requests.post('https://api.example.com/api/upload', 
                         files=files, data=data)
job_id = response.json()['jobId']`)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="text-sm text-gray-300 font-mono">{`import requests

files = {'file': open('video.mp4', 'rb')}
data = {
    'type': 'video',
    'language': 'en',
    'detailLevel': 'detailed'
}

response = requests.post('https://api.example.com/api/upload', 
                         files=files, data=data)
job_id = response.json()['jobId']`}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* OpenAPI Spec Link */}
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center gap-4">
                    <Info className="w-8 h-8 text-blue-600 flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Full API Documentation</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Access the complete OpenAPI specification and interactive API explorer
                      </p>
                      <a
                        href="/api/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-3 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View OpenAPI Docs
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Developer View */}
            {viewMode === 'developer' && (
              <motion.div
                key="developer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">Developer Tools</h2>
                  
                  {/* Performance Metrics */}
                  <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                      <BarChart3 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                      <p className="text-3xl font-bold text-gray-900">98.5%</p>
                      <p className="text-sm text-gray-600">API Uptime</p>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                      <Zap className="w-12 h-12 text-green-600 mx-auto mb-3" />
                      <p className="text-3xl font-bold text-gray-900">145ms</p>
                      <p className="text-sm text-gray-600">Avg Response Time</p>
                    </div>
                    <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                      <Globe className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                      <p className="text-3xl font-bold text-gray-900">5</p>
                      <p className="text-sm text-gray-600">Active Regions</p>
                    </div>
                  </div>

                  {/* SDK Downloads */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">SDK & Libraries</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">JavaScript/TypeScript SDK</p>
                          <p className="text-sm text-gray-600">npm install @voice-api/sdk</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Python SDK</p>
                          <p className="text-sm text-gray-600">pip install voice-api-sdk</p>
                        </div>
                        <Download className="w-5 h-5 text-gray-600" />
                      </div>
                    </div>
                  </div>

                  {/* Testing Tools */}
                  <div className="mt-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Testing Tools</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-center">
                        <TestTube className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Run Test Suite</p>
                        <p className="text-xs text-gray-600 mt-1">Execute full test coverage</p>
                      </button>
                      <button className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-center">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Validate WCAG</p>
                        <p className="text-xs text-gray-600 mt-1">Check accessibility compliance</p>
                      </button>
                      <button className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-center">
                        <BarChart3 className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-900">Load Testing</p>
                        <p className="text-xs text-gray-600 mt-1">Simulate high traffic</p>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Export Options */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Export & Integration</h3>
                  <div className="grid md:grid-cols-4 gap-3">
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                      Export to CSV
                    </button>
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                      Export to JSON
                    </button>
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                      Webhook Setup
                    </button>
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                      API Keys
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Developer Tools Panel (Floating) */}
        <AnimatePresence>
          {showDevTools && (
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              transition={{ type: 'spring', damping: 20 }}
              className="fixed right-0 top-20 w-96 h-[calc(100vh-5rem)] bg-white shadow-2xl border-l border-gray-200 overflow-hidden z-40"
            >
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Developer Console</h3>
                    <button
                      onClick={() => setShowDevTools(false)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      ×
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Network Activity */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Network Activity</h4>
                    <div className="space-y-2">
                      <div className="p-2 bg-gray-50 rounded text-xs font-mono">
                        <span className="text-green-600">200</span> GET /api/aws-status
                      </div>
                      <div className="p-2 bg-gray-50 rounded text-xs font-mono">
                        <span className="text-green-600">200</span> GET /api/health
                      </div>
                      {currentJob && (
                        <div className="p-2 bg-gray-50 rounded text-xs font-mono">
                          <span className="text-blue-600">202</span> POST /api/upload
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Current Job Details */}
                  {currentJob && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Current Job</h4>
                      <div className="p-3 bg-gray-50 rounded">
                        <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">
{JSON.stringify(currentJob, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* System Info */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">System Info</h4>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div>API Version: 1.0.0</div>
                      <div>Region: us-east-1</div>
                      <div>Environment: Production</div>
                      <div>SDK Version: 2.3.1</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </QueryClientProvider>
  );
}