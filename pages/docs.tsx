import { useEffect } from 'react';
import Head from 'next/head';

export default function ApiDocs() {
  useEffect(() => {
    // Load Swagger UI
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js';
    script.async = true;
    document.head.appendChild(script);

    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css';
    document.head.appendChild(cssLink);

    script.onload = () => {
      // Initialize Swagger UI
      (window as any).SwaggerUIBundle({
        url: '/api/docs',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          (window as any).SwaggerUIBundle.presets.apis,
          (window as any).SwaggerUIBundle.presets.standalone
        ],
        plugins: [
          (window as any).SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };

    return () => {
      document.head.removeChild(script);
      document.head.removeChild(cssLink);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Voice Description API - Documentation</title>
        <meta name="description" content="API documentation for Voice Description API - Automated video audio description system" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={{ padding: '20px' }}>
        <div style={{ 
          background: '#1f2937', 
          color: 'white', 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '2.5rem' }}>
            🎬 Voice Description API
          </h1>
          <p style={{ margin: '0', fontSize: '1.1rem', opacity: 0.9 }}>
            Automated video audio description system using AWS AI services
          </p>
          <div style={{ marginTop: '15px', fontSize: '0.9rem', opacity: 0.8 }}>
            <strong>Technology Stack:</strong> AWS Rekognition • Amazon Nova Pro • AWS Polly • Next.js
          </div>
        </div>

        <div style={{ 
          background: '#f3f4f6', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #d1d5db'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>🚀 Quick Start</h3>
          <ol style={{ margin: '0', paddingLeft: '20px', color: '#4b5563' }}>
            <li>Upload video using <code>/api/upload</code> endpoint</li>
            <li>Monitor processing with <code>/api/status/{'{jobId}'}</code></li>
            <li>Download results from <code>/api/results/{'{jobId}'}/text</code> and <code>/api/results/{'{jobId}'}/audio</code></li>
          </ol>
        </div>

        <div style={{ 
          background: '#fef3c7', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #f59e0b'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#92400e' }}>⚡ Real-Time Processing Pipeline</h4>
          <div style={{ fontSize: '0.9rem', color: '#78350f' }}>
            <strong>Step 1:</strong> AWS Rekognition video segmentation → 
            <strong>Step 2:</strong> Amazon Nova Pro multimodal analysis → 
            <strong>Step 3:</strong> AWS Polly text-to-speech synthesis
          </div>
        </div>

        <div id="swagger-ui"></div>
      </div>
    </>
  );
}