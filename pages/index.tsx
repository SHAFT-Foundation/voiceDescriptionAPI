import React, { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { UploadForm } from '../components/UploadForm';
import { StatusDisplay } from '../components/StatusDisplay';
import { ResultsDisplay } from '../components/ResultsDisplay';

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState<boolean>(false);
  const [awsStatus, setAwsStatus] = useState<any>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  const handleUploadSuccess = useCallback((jobId: string) => {
    setCurrentJobId(jobId);
    setUploadComplete(true);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentJobId(null);
    setUploadComplete(false);
    setJobStatus(null);
  }, []);

  // Load AWS status on component mount
  useEffect(() => {
    const fetchAwsStatus = async () => {
      try {
        const response = await fetch('/api/aws-status');
        const result = await response.json();
        if (result.success) {
          setAwsStatus(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch AWS status:', error);
      }
    };

    fetchAwsStatus();
  }, []);

  // Poll job status when job ID is available
  useEffect(() => {
    if (currentJobId) {
      const fetchJobStatus = async () => {
        try {
          const response = await fetch(`/api/status/${currentJobId}`);
          const result = await response.json();
          if (result.success) {
            setJobStatus(result.data);
          }
        } catch (error) {
          console.error('Failed to fetch job status:', error);
        }
      };

      fetchJobStatus();
      
      // Poll every 2 minutes while processing to reduce server load during heavy analysis
      const interval = setInterval(() => {
        if (jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed') {
          fetchJobStatus();
        }
      }, 120000); // 2 minutes
      
      return () => clearInterval(interval);
    }
  }, [currentJobId, jobStatus?.status]);

  return (
    <>
      <Head>
        <title>Voice Description API - AI-Powered Video Accessibility</title>
        <meta name="description" content="Generate audio descriptions for videos to improve accessibility" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Voice Description API</h1>
                <p className="text-sm text-gray-500 mt-1">AI-powered video accessibility platform</p>
              </div>
              {awsStatus && (
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    awsStatus.overall?.status === 'all_connected' ? 'bg-green-500' : 
                    awsStatus.overall?.status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-gray-600">AWS Status: {awsStatus.overall?.connectedServices || 'Checking...'}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Upload/Results */}
            <div className="lg:col-span-2">
              {!uploadComplete ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">Upload Video</h2>
                  <UploadForm onUploadSuccess={handleUploadSuccess} />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Status Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Processing Status</h2>
                      {jobStatus && (
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          jobStatus.status === 'completed' ? 'bg-green-100 text-green-700' :
                          jobStatus.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {jobStatus.status?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <StatusDisplay jobId={currentJobId!} jobStatus={jobStatus} />
                  </div>

                  {/* Results Card */}
                  {jobStatus?.status === 'completed' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Download Results</h2>
                      <ResultsDisplay jobId={currentJobId!} />
                    </div>
                  )}

                  {/* Reset Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={handleReset}
                      className="px-6 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Process Another Video
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Status Panel */}
            <div className="space-y-6">
              {/* AWS Services Status */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">AWS Services</h3>
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showDebug ? 'Hide' : 'Show'} Details
                  </button>
                </div>
                
                {awsStatus?.services && (
                  <div className="space-y-3">
                    {Object.entries(awsStatus.services).map(([service, info]: [string, any]) => (
                      <div key={service} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            info.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <span className="text-sm font-medium capitalize">{service}</span>
                        </div>
                        {showDebug && (
                          <span className="text-xs text-gray-500">
                            {info.status === 'connected' ? 'Connected' : 'Error'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pipeline Status */}
              {currentJobId && jobStatus && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Pipeline Progress</h3>
                  <div className="space-y-3">
                    {/* Rekognition */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          jobStatus.step === 'segmentation' ? 'bg-blue-500 text-white' :
                          jobStatus.progress > 0 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                        }`}>
                          {jobStatus.progress > 0 ? '✓' : '1'}
                        </div>
                        <span className="text-sm">Video Segmentation</span>
                      </div>
                      {jobStatus.step === 'segmentation' && (
                        <span className="text-xs text-blue-600">Active</span>
                      )}
                    </div>

                    {/* Bedrock */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          jobStatus.step === 'analysis' ? 'bg-blue-500 text-white' :
                          jobStatus.progress > 40 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                        }`}>
                          {jobStatus.progress > 40 ? '✓' : '2'}
                        </div>
                        <span className="text-sm">Scene Analysis</span>
                      </div>
                      {jobStatus.step === 'analysis' && (
                        <span className="text-xs text-blue-600">Active</span>
                      )}
                    </div>

                    {/* Polly */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          jobStatus.step === 'synthesis' ? 'bg-blue-500 text-white' :
                          jobStatus.progress > 70 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                        }`}>
                          {jobStatus.progress > 70 ? '✓' : '3'}
                        </div>
                        <span className="text-sm">Audio Synthesis</span>
                      </div>
                      {jobStatus.step === 'synthesis' && (
                        <span className="text-xs text-blue-600">Active</span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-500"
                        style={{ width: `${jobStatus.progress || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{jobStatus.progress || 0}% Complete</p>
                  </div>

                  {/* Status Message */}
                  {jobStatus.message && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">{jobStatus.message}</p>
                    </div>
                  )}

                  {/* Job Details */}
                  {showDebug && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Job ID:</span>
                        <span className="text-gray-700 font-mono">{currentJobId.slice(0, 8)}...</span>
                      </div>
                      {jobStatus.rekognitionJobId && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Rekognition ID:</span>
                          <span className="text-gray-700 font-mono">{jobStatus.rekognitionJobId.slice(0, 8)}...</span>
                        </div>
                      )}
                      {jobStatus.segmentCount > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Segments Found:</span>
                          <span className="text-gray-700">{jobStatus.segmentCount}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Links */}
              {showDebug && awsStatus && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">AWS Console</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <a 
                      href={`https://console.aws.amazon.com/rekognition/home?region=${awsStatus.region || 'us-east-1'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Rekognition →
                    </a>
                    <a 
                      href={`https://console.aws.amazon.com/bedrock/home?region=${awsStatus.region || 'us-east-1'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Bedrock →
                    </a>
                    <a 
                      href={`https://console.aws.amazon.com/polly/home?region=${awsStatus.region || 'us-east-1'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Polly →
                    </a>
                    <a 
                      href={`https://console.aws.amazon.com/s3/home?region=${awsStatus.region || 'us-east-1'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      S3 Storage →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Features */}
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Video Analysis</h3>
              <p className="text-xs text-gray-500">AWS Rekognition segments and analyzes video scenes</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">AI Descriptions</h3>
              <p className="text-xs text-gray-500">Bedrock Nova Pro generates contextual scene descriptions</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Natural Speech</h3>
              <p className="text-xs text-gray-500">Amazon Polly creates high-quality audio narration</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}