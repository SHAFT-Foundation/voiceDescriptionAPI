import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, CheckCircle2, AlertCircle, Clock, Cpu, 
  FileVideo, Brain, Mic, Download, Loader2, 
  ChevronRight, BarChart3, Zap, Shield
} from 'lucide-react';

interface ProcessingDashboardProps {
  jobId: string;
  jobType: 'video' | 'image';
  onComplete?: (results: any) => void;
  onError?: (error: any) => void;
}

interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  step: string;
  progress: number;
  message?: string;
  startTime?: Date;
  endTime?: Date;
  estimatedTimeRemaining?: number;
  segmentCount?: number;
  currentSegment?: number;
  performance?: {
    cpuUsage?: number;
    memoryUsage?: number;
    throughput?: string;
  };
}

interface PipelineStep {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress?: number;
  duration?: number;
  details?: string;
}

export const ProcessingDashboard: React.FC<ProcessingDashboardProps> = ({
  jobId,
  jobType,
  onComplete,
  onError,
}) => {
  const [jobStatus, setJobStatus] = useState<JobStatus>({
    status: 'pending',
    step: 'initialization',
    progress: 0,
  });
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Initialize pipeline steps based on job type
  useEffect(() => {
    const steps: PipelineStep[] = jobType === 'video' ? [
      {
        id: 'upload',
        name: 'File Upload',
        description: 'Uploading to S3 storage',
        icon: FileVideo,
        status: 'completed',
      },
      {
        id: 'segmentation',
        name: 'Scene Detection',
        description: 'Analyzing video segments with AWS Rekognition',
        icon: Activity,
        status: 'pending',
      },
      {
        id: 'extraction',
        name: 'Scene Extraction',
        description: 'Extracting individual scenes with FFmpeg',
        icon: Zap,
        status: 'pending',
      },
      {
        id: 'analysis',
        name: 'AI Analysis',
        description: 'Generating descriptions with Bedrock Nova Pro',
        icon: Brain,
        status: 'pending',
      },
      {
        id: 'synthesis',
        name: 'Audio Synthesis',
        description: 'Creating narration with Amazon Polly',
        icon: Mic,
        status: 'pending',
      },
      {
        id: 'delivery',
        name: 'Results Ready',
        description: 'Files available for download',
        icon: Download,
        status: 'pending',
      },
    ] : [
      {
        id: 'upload',
        name: 'Image Upload',
        description: 'Uploading to S3 storage',
        icon: FileVideo,
        status: 'completed',
      },
      {
        id: 'analysis',
        name: 'AI Analysis',
        description: 'Analyzing image with Bedrock Nova Pro',
        icon: Brain,
        status: 'pending',
      },
      {
        id: 'synthesis',
        name: 'Audio Synthesis',
        description: 'Creating narration with Amazon Polly',
        icon: Mic,
        status: 'pending',
      },
      {
        id: 'delivery',
        name: 'Results Ready',
        description: 'Files available for download',
        icon: Download,
        status: 'pending',
      },
    ];
    setPipelineSteps(steps);
  }, [jobType]);

  // Poll job status
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const endpoint = jobType === 'image' 
          ? `/api/status/image/${jobId}`
          : `/api/status/${jobId}`;
        
        const response = await fetch(endpoint);
        const result = await response.json();

        if (result.success && result.data) {
          const status = result.data;
          setJobStatus(status);

          // Update pipeline steps based on status
          setPipelineSteps(prev => {
            const updated = [...prev];
            const currentStepIndex = updated.findIndex(s => s.id === status.step);
            
            updated.forEach((step, index) => {
              if (index < currentStepIndex) {
                step.status = 'completed';
                step.progress = 100;
              } else if (index === currentStepIndex) {
                step.status = status.status === 'failed' ? 'error' : 'active';
                step.progress = status.progress;
                step.details = status.message;
              } else {
                step.status = 'pending';
                step.progress = 0;
              }
            });

            return updated;
          });

          // Handle completion
          if (status.status === 'completed' && onComplete) {
            onComplete(result.data);
          } else if (status.status === 'failed' && onError) {
            onError(result.error || { message: 'Processing failed' });
          }
        }
      } catch (error) {
        console.error('Failed to fetch job status:', error);
        if (onError) {
          onError(error);
        }
      }
    };

    // Initial poll
    pollStatus();

    // Set up polling interval
    const interval = setInterval(() => {
      if (jobStatus.status !== 'completed' && jobStatus.status !== 'failed') {
        pollStatus();
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [jobId, jobType, jobStatus.status, onComplete, onError]);

  // Track elapsed time
  useEffect(() => {
    if (jobStatus.status === 'processing') {
      const timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [jobStatus.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'active': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-400 bg-gray-100';
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Processing Your {jobType === 'video' ? 'Video' : 'Image'}</h2>
            <p className="text-sm text-gray-600 mt-1">Job ID: {jobId.slice(0, 8)}...</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Status Badge */}
            <span className={`px-4 py-2 text-sm font-semibold rounded-full flex items-center gap-2 ${
              jobStatus.status === 'completed' ? 'bg-green-100 text-green-700' :
              jobStatus.status === 'failed' ? 'bg-red-100 text-red-700' :
              jobStatus.status === 'processing' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {jobStatus.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}
              {jobStatus.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
              {jobStatus.status === 'failed' && <AlertCircle className="w-4 h-4" />}
              {jobStatus.status.toUpperCase()}
            </span>

            {/* Elapsed Time */}
            {jobStatus.status === 'processing' && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                {formatTime(elapsedTime)}
              </div>
            )}
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Progress</span>
            <span className="font-semibold text-gray-900">{jobStatus.progress}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${jobStatus.progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-full ${
                jobStatus.status === 'failed' 
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : jobStatus.status === 'completed'
                  ? 'bg-gradient-to-r from-green-500 to-green-600'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600'
              }`}
            />
          </div>
        </div>

        {/* Current Status Message */}
        {jobStatus.message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-blue-50 rounded-lg"
          >
            <p className="text-sm text-blue-700">{jobStatus.message}</p>
          </motion.div>
        )}
      </div>

      {/* Pipeline Steps */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Processing Pipeline</h3>
        <div className="space-y-4">
          {pipelineSteps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative flex items-start gap-4 p-4 rounded-lg border transition-all ${
                step.status === 'active' 
                  ? 'border-blue-300 bg-blue-50' 
                  : step.status === 'completed'
                  ? 'border-green-200 bg-green-50'
                  : step.status === 'error'
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/* Step Icon */}
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${getStatusColor(step.status)}`}>
                <step.icon className="w-6 h-6" />
              </div>

              {/* Step Content */}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">{step.name}</h4>
                  {step.status === 'active' && step.progress !== undefined && (
                    <span className="text-sm font-medium text-blue-600">{step.progress}%</span>
                  )}
                  {step.status === 'completed' && (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                
                {/* Step Progress Bar */}
                {step.status === 'active' && step.progress !== undefined && (
                  <div className="mt-2 w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${step.progress}%` }}
                      transition={{ duration: 0.3 }}
                      className="h-full bg-blue-500"
                    />
                  </div>
                )}

                {/* Step Details */}
                {step.details && (
                  <p className="text-xs text-gray-500 mt-2">{step.details}</p>
                )}
              </div>

              {/* Connector Line */}
              {index < pipelineSteps.length - 1 && (
                <div className={`absolute left-[28px] top-[64px] w-0.5 h-8 ${
                  step.status === 'completed' ? 'bg-green-300' : 'bg-gray-300'
                }`} />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      {jobStatus.status === 'processing' && jobStatus.performance && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            Performance Metrics
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Cpu className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {jobStatus.performance.cpuUsage || 0}%
              </p>
              <p className="text-sm text-gray-600">CPU Usage</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {jobStatus.performance.memoryUsage || 0}%
              </p>
              <p className="text-sm text-gray-600">Memory Usage</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Zap className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {jobStatus.performance.throughput || 'N/A'}
              </p>
              <p className="text-sm text-gray-600">Throughput</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Additional Details Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full py-3 px-4 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
      >
        <ChevronRight className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
        {showDetails ? 'Hide' : 'Show'} Technical Details
      </button>

      {/* Technical Details */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-50 rounded-lg p-6 space-y-3"
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Job ID:</span>
                <p className="font-mono text-gray-900">{jobId}</p>
              </div>
              <div>
                <span className="text-gray-600">Job Type:</span>
                <p className="font-medium text-gray-900">{jobType.toUpperCase()}</p>
              </div>
              {jobStatus.segmentCount && (
                <div>
                  <span className="text-gray-600">Total Segments:</span>
                  <p className="font-medium text-gray-900">{jobStatus.segmentCount}</p>
                </div>
              )}
              {jobStatus.currentSegment && (
                <div>
                  <span className="text-gray-600">Current Segment:</span>
                  <p className="font-medium text-gray-900">{jobStatus.currentSegment}</p>
                </div>
              )}
              {jobStatus.estimatedTimeRemaining && (
                <div>
                  <span className="text-gray-600">Est. Time Remaining:</span>
                  <p className="font-medium text-gray-900">
                    {Math.ceil(jobStatus.estimatedTimeRemaining / 60)} minutes
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};