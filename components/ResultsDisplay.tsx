import React, { useState } from 'react';

interface ResultsDisplayProps {
  jobId: string;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ jobId }) => {
  const [downloading, setDownloading] = useState<{ text: boolean; audio: boolean }>({
    text: false,
    audio: false,
  });

  const handleDownload = async (type: 'text' | 'audio') => {
    setDownloading(prev => ({ ...prev, [type]: true }));

    try {
      const url = `/api/results/${jobId}/${type}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to download ${type}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const extension = type === 'audio' ? 'mp3' : 'txt';
      const fileName = type === 'audio' ? 
        `voice-description-audio-${jobId.slice(0, 8)}.${extension}` : 
        `voice-description-text-${jobId.slice(0, 8)}.${extension}`;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      console.error(`Download ${type} error:`, error);
      alert(`Failed to download ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDownloading(prev => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800">Processing Complete!</p>
            <p className="text-xs text-green-600">Your audio description is ready for download</p>
          </div>
        </div>
      </div>

      {/* Download Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Text Download */}
        <button
          onClick={() => handleDownload('text')}
          disabled={downloading.text}
          className="flex items-center justify-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-gray-900">
              {downloading.text ? 'Downloading...' : 'Text Description'}
            </div>
            <div className="text-xs text-gray-500">.txt file</div>
          </div>
        </button>

        {/* Audio Download */}
        <button
          onClick={() => handleDownload('audio')}
          disabled={downloading.audio}
          className="flex items-center justify-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-gray-900">
              {downloading.audio ? 'Downloading...' : 'Audio Track'}
            </div>
            <div className="text-xs text-gray-500">.mp3 file</div>
          </div>
        </button>
      </div>

      {/* File Info */}
      <div className="text-xs text-gray-500 text-center">
        Files will be saved with prefix: {jobId.slice(0, 8)}...
      </div>
    </div>
  );
};