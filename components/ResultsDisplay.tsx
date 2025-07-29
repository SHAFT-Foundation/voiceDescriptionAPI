import React, { useState, useEffect } from 'react';
import { JobStatus } from '../src/types';

interface ResultsDisplayProps {
  jobId: string;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ jobId }) => {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [downloading, setDownloading] = useState<{ text: boolean; audio: boolean }>({
    text: false,
    audio: false,
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/status/${jobId}`);
        const result = await response.json();
        if (result.success) {
          setStatus(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch status for results:', error);
      }
    };

    fetchStatus();
  }, [jobId]);

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
      link.download = `voice-description-${jobId}.${extension}`;
      
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

  // Only show results if processing is completed
  if (!status || status.status !== 'completed') {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Download Results</h3>
      
      <div className="space-y-3">
        {/* Text Download */}
        <button
          onClick={() => handleDownload('text')}
          disabled={downloading.text}
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="text-blue-600">📝</div>
            <div className="text-left">
              <div className="font-medium text-gray-900">Text Description</div>
              <div className="text-sm text-gray-500">Download scene descriptions as text file</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {downloading.text ? 'Downloading...' : 'Download'}
          </div>
        </button>

        {/* Audio Download */}
        <button
          onClick={() => handleDownload('audio')}
          disabled={downloading.audio}
          className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="text-green-600">🎵</div>
            <div className="text-left">
              <div className="font-medium text-gray-900">Audio Description</div>
              <div className="text-sm text-gray-500">Download narrated audio track (MP3)</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {downloading.audio ? 'Downloading...' : 'Download'}
          </div>
        </button>
      </div>

      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="text-sm text-green-800">
          <strong>✅ Processing Complete!</strong> Your video has been successfully analyzed and audio descriptions have been generated.
        </div>
      </div>
    </div>
  );
};