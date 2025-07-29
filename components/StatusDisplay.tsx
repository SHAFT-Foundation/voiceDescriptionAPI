import React, { useState, useEffect } from 'react';
import { JobStatus } from '../src/types';

interface StatusDisplayProps {
  jobId: string;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ jobId }) => {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/status/${jobId}`);
        const result = await response.json();

        if (result.success) {
          setStatus(result.data);
          setError(null);

          if (result.data.status === 'completed' || result.data.status === 'failed') {
            setIsPolling(false);
          }
        } else {
          setError(result.error?.message || 'Failed to fetch status');
          setIsPolling(false);
        }
      } catch (error) {
        console.error('Status polling error:', error);
        setError('Failed to connect to server');
        setIsPolling(false);
      }
    };

    pollStatus();

    if (isPolling) {
      intervalId = setInterval(pollStatus, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobId, isPolling]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
          <span className="text-sm text-gray-600">Loading status...</span>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-700 bg-green-50 border-green-200';
      case 'failed': return 'text-red-700 bg-red-50 border-red-200';
      case 'processing': return 'text-blue-700 bg-blue-50 border-blue-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Processing Status</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(status.status)}`}>
          {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
        </div>
      </div>

      {/* Progress Bar */}
      {status.progress !== undefined && (
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{status.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Current Step */}
      {status.step && (
        <div className="text-sm">
          <span className="text-gray-500">Current step:</span>
          <span className="ml-2 font-medium text-gray-900 capitalize">{status.step}</span>
        </div>
      )}

      {/* Message */}
      {status.message && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          {status.message}
        </div>
      )}

      {/* Job Info */}
      <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
        <div>Job ID: {jobId}</div>
        {status.createdAt && (
          <div>Started: {new Date(status.createdAt).toLocaleString()}</div>
        )}
      </div>
    </div>
  );
};