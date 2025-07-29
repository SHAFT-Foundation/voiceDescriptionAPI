import React from 'react';

interface StatusDisplayProps {
  jobId: string;
  jobStatus: any;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ jobId, jobStatus }) => {
  if (!jobStatus) {
    return (
      <div className="flex items-center gap-3">
        <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        <span className="text-sm text-gray-600">Initializing processing...</span>
      </div>
    );
  }

  if (jobStatus.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Processing Failed</span>
        </div>
        <p className="text-sm text-red-600 mt-2">{jobStatus.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Progress</span>
          <span>{jobStatus.progress || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-700"
            style={{ width: `${jobStatus.progress || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Current Step Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-3">
          {jobStatus.status === 'processing' ? (
            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
          ) : jobStatus.status === 'completed' ? (
            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900 capitalize">
              {jobStatus.step === 'segmentation' ? 'Video Segmentation' :
               jobStatus.step === 'analysis' ? 'Scene Analysis' :
               jobStatus.step === 'synthesis' ? 'Audio Synthesis' :
               jobStatus.step || 'Processing'}
            </p>
            {jobStatus.message && (
              <p className="text-xs text-gray-500">{jobStatus.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Technical Details */}
      {(jobStatus.rekognitionJobId || jobStatus.segmentCount > 0) && (
        <div className="text-xs text-gray-500 space-y-1">
          {jobStatus.rekognitionJobId && (
            <div>Rekognition Job: {jobStatus.rekognitionJobId.slice(0, 12)}...</div>
          )}
          {jobStatus.segmentCount > 0 && (
            <div>Video Segments: {jobStatus.segmentCount}</div>
          )}
          <div>Job ID: {jobId.slice(0, 8)}...</div>
        </div>
      )}
    </div>
  );
};