import React, { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { UploadForm } from '../components/UploadForm';
import { StatusDisplay } from '../components/StatusDisplay';
import { ResultsDisplay } from '../components/ResultsDisplay';

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState<boolean>(false);
  const [awsStatus, setAwsStatus] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);

  const handleUploadSuccess = useCallback((jobId: string) => {
    setCurrentJobId(jobId);
    setUploadComplete(true);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentJobId(null);
    setUploadComplete(false);
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

  // Load debug info when job ID changes
  useEffect(() => {
    if (currentJobId) {
      const fetchDebugInfo = async () => {
        try {
          const response = await fetch(`/api/debug/${currentJobId}`);
          const result = await response.json();
          if (result.success) {
            setDebugInfo(result.data);
          }
        } catch (error) {
          console.error('Failed to fetch debug info:', error);
        }
      };

      fetchDebugInfo();
      // Refresh debug info every 10 seconds
      const interval = setInterval(fetchDebugInfo, 10000);
      return () => clearInterval(interval);
    }
  }, [currentJobId]);

  return (
    <>
      <Head>
        <title>Voice Description API</title>
        <meta name="description" content="Generate audio descriptions for videos to improve accessibility" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Clean Header */}
          <header className="text-center mb-16">
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">
              Voice Description API
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
              Generate audio descriptions for videos using AI-powered scene analysis
            </p>
          </header>

          {/* Main Content */}
          <div className="max-w-2xl mx-auto">
            {!uploadComplete ? (
              <UploadForm onUploadSuccess={handleUploadSuccess} />
            ) : (
              <div className="space-y-8">
                <StatusDisplay jobId={currentJobId!} />
                <ResultsDisplay jobId={currentJobId!} />
                
                {/* AWS Debug Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">AWS Service Debug</h3>
                    <button
                      onClick={() => setShowDebug(!showDebug)}
                      className="px-3 py-1 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50"
                    >
                      {showDebug ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                  
                  {/* AWS Status Overview */}
                  {awsStatus && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${
                          awsStatus.overall?.status === 'all_connected' ? 'bg-green-500' :
                          awsStatus.overall?.status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span className="font-medium">
                          {awsStatus.overall?.status === 'all_connected' ? '✅ All AWS Services Connected' :
                           awsStatus.overall?.status === 'partial' ? '⚠️ Some AWS Services Connected' : '❌ AWS Connection Issues'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Services: {awsStatus.overall?.connectedServices} | Ready: {awsStatus.overall?.readyForProcessing ? 'Yes' : 'No'}
                      </div>
                    </div>
                  )}

                  {showDebug && (
                    <div className="space-y-4">
                      {/* AWS Services Status */}
                      {awsStatus && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">AWS Services</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {Object.entries(awsStatus.services).map(([service, info]: [string, any]) => (
                              <div key={service} className="bg-white p-3 rounded border">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${info.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <span className="font-medium capitalize">{service}</span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  {info.status === 'connected' ? '✅ Connected' : `❌ ${info.error}`}
                                </div>
                                {info.objectCount !== undefined && (
                                  <div className="text-xs text-gray-500 mt-1">Files: {info.objectCount}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Job Debug Info */}
                      {debugInfo && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Job Debug Info</h4>
                          <div className="bg-white p-4 rounded border text-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <strong>Job ID:</strong> {debugInfo.jobId}
                              </div>
                              <div>
                                <strong>Video File:</strong> {debugInfo.checks?.videoFile?.status === 'found' ? '✅ Found' : '❌ Not Found'}
                              </div>
                              <div>
                                <strong>S3 Access:</strong> {debugInfo.checks?.s3Access?.status === 'success' ? '✅ Working' : '❌ Error'}
                              </div>
                              <div>
                                <strong>Rekognition:</strong> {debugInfo.checks?.rekognition?.status === 'accessible' ? '✅ Ready' : '❌ Error'}
                              </div>
                            </div>
                            
                            {debugInfo.nextSteps && debugInfo.nextSteps.length > 0 && (
                              <div className="mt-4 pt-4 border-t">
                                <strong className="block mb-2">Next Steps:</strong>
                                <ul className="list-disc list-inside space-y-1 text-gray-600">
                                  {debugInfo.nextSteps.map((step: string, index: number) => (
                                    <li key={index}>{step}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {debugInfo.checks?.videoFile?.status === 'found' && (
                              <div className="mt-3 pt-3 border-t">
                                <strong>Video Details:</strong>
                                <div className="text-gray-600">
                                  File: {debugInfo.checks.videoFile.fileName}<br/>
                                  Size: {Math.round(debugInfo.checks.videoFile.size / 1024 / 1024)} MB<br/>
                                  Type: {debugInfo.checks.videoFile.contentType}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* AWS Console Links */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">AWS Console Links</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <a 
                            href={`https://console.aws.amazon.com/rekognition/home?region=${awsStatus?.region || 'us-east-1'}#/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            🎬 Rekognition Console
                          </a>
                          <a 
                            href={`https://console.aws.amazon.com/s3/buckets/${awsStatus?.services?.s3?.inputBucket}?region=${awsStatus?.region || 'us-east-1'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            📁 S3 Bucket
                          </a>
                          <a 
                            href={`https://console.aws.amazon.com/bedrock/home?region=${awsStatus?.region || 'us-east-1'}#/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            🧠 Bedrock Console
                          </a>
                          <a 
                            href={`https://console.aws.amazon.com/polly/home?region=${awsStatus?.region || 'us-east-1'}#/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            🎤 Polly Console
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Clean Reset Button */}
                <div className="text-center pt-8">
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    ← Process Another Video
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Minimal Features Section */}
          <div className="mt-24 max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="space-y-2">
                <div className="text-blue-600 font-medium">AI Analysis</div>
                <p className="text-gray-500 text-sm">Scene understanding with Bedrock Nova Pro</p>
              </div>
              <div className="space-y-2">
                <div className="text-green-600 font-medium">Natural Audio</div>
                <p className="text-gray-500 text-sm">High-quality voice synthesis with Polly</p>
              </div>
              <div className="space-y-2">
                <div className="text-purple-600 font-medium">Secure Processing</div>
                <p className="text-gray-500 text-sm">AWS infrastructure with automatic cleanup</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}