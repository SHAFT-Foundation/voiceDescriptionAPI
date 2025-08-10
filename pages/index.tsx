import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  ChevronRight, ArrowRight, Check, Code, Globe, Shield,
  Zap, Terminal, Database, Cloud, Lock, BarChart,
  Play, FileVideo, Image, Menu, X, Github, ExternalLink,
  Sparkles, Eye, Mic, Volume2, Bot, Wand2
} from 'lucide-react';

// Import components
import { FileUploader } from '../components/FileUploader';
import { ProcessingDashboard } from '../components/ProcessingDashboard';
import { EnhancedResultsDisplay } from '../components/EnhancedResultsDisplay';

interface ProcessingJob {
  jobId: string;
  type: 'video' | 'image';
  fileName: string;
  startTime: Date;
  status: string;
  progress: number;
}

type ViewMode = 'idle' | 'processing' | 'results';

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('idle');
  const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
  const [demoTab, setDemoTab] = useState<'video' | 'image'>('video');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll for navbar
  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle file upload
  const handleFileUpload = async (file: File, type: 'video' | 'image', metadata: any) => {
    const newJob: ProcessingJob = {
      jobId: Date.now().toString(),
      type,
      fileName: file.name,
      startTime: new Date(),
      status: 'processing',
      progress: 0,
    };
    setCurrentJob(newJob);
    setViewMode('processing');
  };

  // Handle processing complete
  const handleProcessingComplete = (results: any) => {
    if (currentJob) {
      setCurrentJob({ ...currentJob, status: 'completed', progress: 100 });
    }
    setViewMode('results');
  };

  // Handle processing error
  const handleProcessingError = (error: any) => {
    if (currentJob) {
      setCurrentJob({ ...currentJob, status: 'failed' });
    }
    console.error('Processing error:', error);
  };

  return (
    <>
      <Head>
        <title>Voice Description API - Enterprise Audio Description Platform</title>
        <meta name="description" content="Enterprise-grade API for automated audio descriptions. Transform videos and images into accessible content with AI-powered narration." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/20 to-white">
        {/* Background Pattern */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/5 via-transparent to-indigo-400/5"></div>
        </div>

        {/* Navigation */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm' : 'bg-transparent'
        }`}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center">
                <Link href="/" className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Voice Description API
                  </span>
                </Link>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-8">
                <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Features
                </Link>
                <Link href="#developers" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Developers
                </Link>
                <Link href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Pricing
                </Link>
                <Link href="/api/docs" className="text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1">
                  Docs <ExternalLink className="w-3 h-3" />
                </Link>
                <Link href="#demo" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Try Demo
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Professional Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-white/95 backdrop-blur-sm shadow-lg border-t border-gray-100">
              <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="space-y-1">
                  <Link href="#features" className="block px-3 py-2 text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors font-medium">
                    Features
                  </Link>
                  <Link href="#developers" className="block px-3 py-2 text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors font-medium">
                    Developers
                  </Link>
                  <Link href="#pricing" className="block px-3 py-2 text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors font-medium">
                    Pricing
                  </Link>
                  <Link href="/api/docs" className="block px-3 py-2 text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors font-medium">
                    Documentation
                  </Link>
                  <div className="pt-2">
                    <Link href="#demo" className="block px-3 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold text-center">
                      Get Started
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="pt-32 pb-20 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-6">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span>
                  Powered by AWS Bedrock Nova Pro
                </span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Audio descriptions for
                <br />
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  accessible content
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Enterprise-grade API that automatically generates audio descriptions for videos and images. 
                Make your content accessible to millions of visually impaired users worldwide.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <Link href="#demo" className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all">
                  Try Live Demo
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
                <Link href="/api/docs" className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                  <Code className="mr-2 w-5 h-5" />
                  View API Docs
                </Link>
              </div>

              {/* Code Example */}
              <div className="max-w-2xl mx-auto">
                <div className="text-left">
                  <div className="text-sm text-gray-500 mb-2">Quick Start</div>
                  <div className="bg-gray-900 rounded-lg p-4 text-left">
                    <pre className="text-sm text-gray-300">
{`curl -X POST https://api.voicedescription.io/v1/process \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"video_url": "https://example.com/video.mp4"}'`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="py-12 bg-gray-50 border-y border-gray-200">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              <div className="text-gray-400 font-semibold">Trusted by</div>
              {['AWS', 'Microsoft', 'Google Cloud', 'Netflix', 'Adobe'].map((company) => (
                <div key={company} className="text-gray-400 font-semibold text-lg">
                  {company}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Built for scale and reliability
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Production-ready infrastructure designed to handle millions of requests with 
                enterprise-grade security and compliance.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Lightning Fast
                </h3>
                <p className="text-gray-600">
                  Process hours of video content in minutes with parallel processing and GPU acceleration.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Enterprise Security
                </h3>
                <p className="text-gray-600">
                  SOC 2 Type II certified with end-to-end encryption, GDPR compliant, and HIPAA ready.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Global Coverage
                </h3>
                <p className="text-gray-600">
                  Support for 30+ languages with native speaker quality and regional accent options.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Cloud className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Auto-Scaling
                </h3>
                <p className="text-gray-600">
                  Elastic infrastructure automatically scales to handle your peak loads without configuration.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Database className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  99.99% Uptime
                </h3>
                <p className="text-gray-600">
                  Redundant infrastructure across multiple regions ensures maximum availability.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Analytics & Insights
                </h3>
                <p className="text-gray-600">
                  Detailed analytics dashboard with usage metrics, performance monitoring, and insights.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section id="demo" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Try it yourself
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Test our API with your own content. No signup required.
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              {/* Clean Demo Tabs */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex bg-white rounded-lg p-1 shadow-sm">
                  <button
                    onClick={() => setDemoTab('video')}
                    className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                      demoTab === 'video'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileVideo className="w-4 h-4" />
                    Video
                  </button>
                  <button
                    onClick={() => setDemoTab('image')}
                    className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                      demoTab === 'image'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Image className="w-4 h-4" />
                    Image
                  </button>
                </div>
              </div>

              {/* Clean Demo Interface */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                {viewMode === 'idle' && (
                  <FileUploader
                    onUpload={handleFileUpload}
                    acceptVideo={demoTab === 'video'}
                    acceptImage={demoTab === 'image'}
                    maxSize={100 * 1024 * 1024}
                  />
                )}

                {viewMode === 'processing' && currentJob && (
                  <ProcessingDashboard
                    jobId={currentJob.jobId}
                    jobType={currentJob.type}
                    onComplete={handleProcessingComplete}
                    onError={handleProcessingError}
                  />
                )}

                {viewMode === 'results' && currentJob && (
                  <>
                    <EnhancedResultsDisplay
                      jobId={currentJob.jobId}
                      jobType={currentJob.type}
                    />
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => {
                          setViewMode('idle');
                          setCurrentJob(null);
                        }}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Process Another File
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Developers Section */}
        <section id="developers" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Built for developers
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Comprehensive SDKs, clear documentation, and powerful APIs make integration seamless.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <Terminal className="w-8 h-8 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  RESTful API
                </h3>
                <p className="text-gray-600 mb-4">
                  Simple, intuitive REST API with predictable resource-oriented URLs and comprehensive error messages.
                </p>
                <Link href="/api/docs" className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center">
                  API Reference <ChevronRight className="inline w-4 h-4 ml-1" />
                </Link>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <Code className="w-8 h-8 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  SDKs & Libraries
                </h3>
                <p className="text-gray-600 mb-4">
                  Official SDKs for Node.js, Python, Ruby, PHP, Java, and Go. Community libraries for many more.
                </p>
                <Link href="/docs/sdks" className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center">
                  Browse SDKs <ChevronRight className="inline w-4 h-4 ml-1" />
                </Link>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <Lock className="w-8 h-8 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Webhooks
                </h3>
                <p className="text-gray-600 mb-4">
                  Real-time notifications when processing completes. Secure webhook endpoints with signature verification.
                </p>
                <Link href="/docs/webhooks" className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center">
                  Webhook Guide <ChevronRight className="inline w-4 h-4 ml-1" />
                </Link>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <Database className="w-8 h-8 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Batch Processing
                </h3>
                <p className="text-gray-600 mb-4">
                  Process thousands of files efficiently with batch endpoints and parallel processing capabilities.
                </p>
                <Link href="/docs/batch" className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center">
                  Batch API <ChevronRight className="inline w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Pay only for what you use. No setup fees or hidden costs.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Developer</h3>
                <div className="text-3xl font-bold text-gray-900 mb-4">
                  Free
                  <span className="text-base font-normal text-gray-600 ml-2">forever</span>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">1,000 API calls/month</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">Basic support</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">All core features</span>
                  </li>
                </ul>
                <button className="w-full bg-gray-100 text-gray-900 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                  Get Started
                </button>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-md border-2 border-indigo-200 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-sm font-medium">Most Popular</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Professional</h3>
                <div className="text-3xl font-bold text-gray-900 mb-4">
                  $99
                  <span className="text-base font-normal text-gray-600 ml-2">/month</span>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">50,000 API calls/month</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">Priority support</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">Batch processing</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">Custom voices</span>
                  </li>
                </ul>
                <button className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
                  Start Free Trial
                </button>
              </div>

              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Enterprise</h3>
                <div className="text-3xl font-bold text-gray-900 mb-4">
                  Custom
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">Unlimited API calls</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">Dedicated support</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">SLA guarantee</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">On-premise option</span>
                  </li>
                </ul>
                <button className="w-full bg-gray-100 text-gray-900 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-indigo-600">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to make your content accessible?
            </h2>
            <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
              Start your free trial today. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="#demo" className="bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
                Start Free Trial
              </Link>
              <Link href="/api/docs" className="bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-800 transition-colors">
                View Documentation
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded flex items-center justify-center">
                    <span className="text-white font-bold text-lg">V</span>
                  </div>
                  <span className="text-lg font-semibold">Voice Description API</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Making content accessible to everyone, everywhere.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><Link href="#features" className="hover:text-white">Features</Link></li>
                  <li><Link href="#pricing" className="hover:text-white">Pricing</Link></li>
                  <li><Link href="/api/docs" className="hover:text-white">API Docs</Link></li>
                  <li><Link href="/changelog" className="hover:text-white">Changelog</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Resources</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><Link href="/docs" className="hover:text-white">Documentation</Link></li>
                  <li><Link href="/guides" className="hover:text-white">Guides</Link></li>
                  <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                  <li><Link href="/support" className="hover:text-white">Support</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><Link href="/about" className="hover:text-white">About</Link></li>
                  <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                  <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                © 2024 Voice Description API. All rights reserved.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <a href="https://github.com" className="text-gray-400 hover:text-white">
                  <Github className="w-5 h-5" />
                </a>
                <a href="https://twitter.com" className="text-gray-400 hover:text-white">
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}