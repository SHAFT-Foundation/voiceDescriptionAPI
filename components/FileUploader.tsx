import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Video, Image, FileVideo, FileImage, X, CheckCircle, 
  AlertCircle, Loader2, FileText, Mic, Globe 
} from 'lucide-react';

interface FileUploaderProps {
  onUpload: (file: File, type: 'video' | 'image', metadata: FileMetadata) => Promise<void>;
  acceptVideo?: boolean;
  acceptImage?: boolean;
  maxSize?: number;
}

interface FileMetadata {
  title?: string;
  description?: string;
  language?: string;
  context?: string;
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  generateAudio?: boolean;
  voiceId?: string;
}

interface FilePreview {
  file: File;
  preview: string;
  type: 'video' | 'image';
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onUpload,
  acceptVideo = true,
  acceptImage = true,
  maxSize = 500 * 1024 * 1024, // 500MB default
}) => {
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata>({
    language: 'en',
    detailLevel: 'detailed',
    generateAudio: true,
    voiceId: 'Joanna',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(`File is too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
      } else {
        setError('Invalid file type. Please upload a video or image file.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const fileType = file.type.startsWith('video/') ? 'video' : 'image';
      
      // Create preview
      const preview = URL.createObjectURL(file);
      setSelectedFile({ file, preview, type: fileType });
    }
  }, [maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
    multiple: false,
    accept: {
      ...(acceptVideo ? { 'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'] } : {}),
      ...(acceptImage ? { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'] } : {}),
    },
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      await onUpload(selectedFile.file, selectedFile.type, metadata);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setSelectedFile(null);
        setUploadProgress(0);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    if (selectedFile) {
      URL.revokeObjectURL(selectedFile.preview);
      setSelectedFile(null);
      setError(null);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* File Drop Zone */}
      <AnimatePresence mode="wait">
        {!selectedFile ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div
              {...getRootProps()}
              className={`
                relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                transition-all duration-200 bg-gradient-to-br
                ${isDragActive 
                  ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                }
                ${error ? 'border-red-300 bg-red-50' : ''}
              `}
            >
              <input {...getInputProps()} />
              
              {/* Upload Icon */}
              <motion.div
                animate={{ y: isDragActive ? -10 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex justify-center mb-4"
              >
                <div className="relative">
                  <Upload className={`w-16 h-16 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
                  <div className="absolute -top-2 -right-2 flex gap-1">
                    {acceptVideo && <Video className="w-6 h-6 text-blue-500" />}
                    {acceptImage && <Image className="w-6 h-6 text-green-500" />}
                  </div>
                </div>
              </motion.div>

              {/* Text */}
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {isDragActive ? 'Drop your file here' : 'Drag & drop or click to upload'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {acceptVideo && acceptImage ? 'Videos or Images' : acceptVideo ? 'Video files' : 'Image files'}
                {' '}up to {maxSize / (1024 * 1024)}MB
              </p>

              {/* Supported Formats */}
              <div className="flex flex-wrap justify-center gap-2">
                {acceptVideo && (
                  <>
                    <span className="px-2 py-1 bg-white text-xs text-gray-600 rounded-md shadow-sm">MP4</span>
                    <span className="px-2 py-1 bg-white text-xs text-gray-600 rounded-md shadow-sm">AVI</span>
                    <span className="px-2 py-1 bg-white text-xs text-gray-600 rounded-md shadow-sm">MOV</span>
                  </>
                )}
                {acceptImage && (
                  <>
                    <span className="px-2 py-1 bg-white text-xs text-gray-600 rounded-md shadow-sm">JPG</span>
                    <span className="px-2 py-1 bg-white text-xs text-gray-600 rounded-md shadow-sm">PNG</span>
                    <span className="px-2 py-1 bg-white text-xs text-gray-600 rounded-md shadow-sm">GIF</span>
                  </>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-red-100 rounded-lg flex items-center justify-center gap-2"
                >
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-red-600">{error}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* File Preview */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start gap-4">
                {/* Preview Thumbnail */}
                <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {selectedFile.type === 'image' ? (
                    <img 
                      src={selectedFile.preview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500">
                      <FileVideo className="w-12 h-12 text-white" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedFile.type === 'video' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {selectedFile.type.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* File Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{selectedFile.file.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Size: {(selectedFile.file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      <p className="text-sm text-gray-600">
                        Type: {selectedFile.file.type || 'Unknown'}
                      </p>
                    </div>
                    {!uploading && (
                      <button
                        onClick={removeFile}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    )}
                  </div>

                  {/* Upload Progress */}
                  {uploading && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">Uploading...</span>
                        <span className="text-sm font-medium text-gray-900">{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.3 }}
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata Form */}
            <div className="p-6 space-y-4 bg-gray-50">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                Processing Options
              </h4>

              {/* Title and Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={metadata.title || ''}
                    onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter a title"
                    disabled={uploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="inline w-4 h-4 mr-1" />
                    Language
                  </label>
                  <select
                    value={metadata.language}
                    onChange={(e) => setMetadata({ ...metadata, language: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={uploading}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Context (Optional)
                </label>
                <textarea
                  value={metadata.context || ''}
                  onChange={(e) => setMetadata({ ...metadata, context: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="Provide additional context to improve description accuracy"
                  disabled={uploading}
                />
              </div>

              {/* Detail Level and Audio Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detail Level
                  </label>
                  <select
                    value={metadata.detailLevel}
                    onChange={(e) => setMetadata({ ...metadata, detailLevel: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={uploading}
                  >
                    <option value="basic">Basic</option>
                    <option value="detailed">Detailed</option>
                    <option value="comprehensive">Comprehensive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mic className="inline w-4 h-4 mr-1" />
                    Voice
                  </label>
                  <select
                    value={metadata.voiceId}
                    onChange={(e) => setMetadata({ ...metadata, voiceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={uploading || !metadata.generateAudio}
                  >
                    <option value="Joanna">Joanna (Female)</option>
                    <option value="Matthew">Matthew (Male)</option>
                    <option value="Salli">Salli (Female)</option>
                    <option value="Joey">Joey (Male)</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={metadata.generateAudio}
                      onChange={(e) => setMetadata({ ...metadata, generateAudio: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={uploading}
                    />
                    <span className="ml-2 text-sm text-gray-700">Generate Audio</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className={`
                    flex-1 py-3 px-6 font-semibold rounded-lg transition-all
                    flex items-center justify-center gap-2
                    ${uploading 
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg'
                    }
                  `}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Generate Description
                    </>
                  )}
                </button>
                {!uploading && (
                  <button
                    onClick={removeFile}
                    className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};