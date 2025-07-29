import React, { useState, useCallback, useRef } from 'react';

interface UploadFormProps {
  onUploadSuccess: (jobId: string) => void;
}

export const UploadForm: React.FC<UploadFormProps> = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 's3uri'>('file');
  const [s3Uri, setS3Uri] = useState('');
  const [metadata, setMetadata] = useState({
    title: '',
    description: '',
    language: 'en',
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      if (uploadMode === 'file') {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          throw new Error('Please select a video file');
        }
        formData.append('video', file);
      } else {
        if (!s3Uri.trim()) {
          throw new Error('Please enter a valid S3 URI');
        }
        formData.append('s3Uri', s3Uri.trim());
      }

      // Add metadata
      formData.append('title', metadata.title);
      formData.append('description', metadata.description);
      formData.append('language', metadata.language);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Upload failed');
      }

      onUploadSuccess(result.data.jobId);

    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [uploadMode, s3Uri, metadata, onUploadSuccess]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8">
      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleFileUpload} className="space-y-6">
        {/* Upload Mode Selection */}
        <div className="space-y-3">
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="upload-method"
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                checked={uploadMode === 'file'}
                onChange={() => setUploadMode('file')}
              />
              <span className="ml-2 text-sm text-gray-700">Upload file</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="upload-method"
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                checked={uploadMode === 's3uri'}
                onChange={() => setUploadMode('s3uri')}
              />
              <span className="ml-2 text-sm text-gray-700">S3 URI</span>
            </label>
          </div>
        </div>

        {/* File Upload */}
        {uploadMode === 'file' && (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 transition-colors">
            <div className="space-y-3">
              <div className="text-gray-400">
                📹
              </div>
              <div>
                <label htmlFor="video-file" className="cursor-pointer">
                  <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Choose video file
                  </span>
                  <input
                    id="video-file"
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                  />
                </label>
                <p className="text-gray-500 text-sm mt-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-400">MP4, AVI, MOV up to 500MB</p>
            </div>
          </div>
        )}

        {/* S3 URI Input */}
        {uploadMode === 's3uri' && (
          <div>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="s3://bucket-name/path/to/video.mp4"
              value={s3Uri}
              onChange={(e) => setS3Uri(e.target.value)}
            />
          </div>
        )}

        {/* Metadata - Simplified */}
        <div className="space-y-4">
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Video title (optional)"
            value={metadata.title}
            onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
          />
          
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={metadata.language}
            onChange={(e) => setMetadata({ ...metadata, language: e.target.value })}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>

          <textarea
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Description (optional)"
            value={metadata.description}
            onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading}
          className="w-full py-3 px-4 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Processing...' : 'Generate Audio Description'}
        </button>
      </form>
    </div>
  );
};