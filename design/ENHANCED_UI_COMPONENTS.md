# Enhanced UI Components & Design Specifications

## Table of Contents
1. [Homepage Hero Design](#1-homepage-hero-design)
2. [Dual-Mode Processing Interface](#2-dual-mode-processing-interface)
3. [Enhanced Results Display](#3-enhanced-results-display)
4. [API Documentation Portal](#4-api-documentation-portal)
5. [Accessibility-First Components](#5-accessibility-first-components)
6. [Mobile Experience](#6-mobile-experience)
7. [Design Tokens & Variables](#7-design-tokens--variables)
8. [Component Implementation Guide](#8-component-implementation-guide)

---

## 1. Homepage Hero Design

### 1.1 Hero Section with Interactive Demo
```jsx
// Hero Component Structure
<HeroSection>
  <AnimatedBackground>
    <WavePattern animate="pulse" />
    <AccessibilityIcons float />
  </AnimatedBackground>
  
  <MainContent>
    <Headline>
      "Making Visual Content"
      <GradientText>Accessible to All</GradientText>
    </Headline>
    
    <SubHeadline>
      Transform videos and images into comprehensive audio descriptions
      powered by AWS AI services
    </SubHeadline>
    
    <CTAButtons>
      <PrimaryButton icon="play">Try Live Demo</PrimaryButton>
      <SecondaryButton icon="code">View API Docs</SecondaryButton>
    </CTAButtons>
    
    <TrustIndicators>
      <Metric value="285M+" label="Users Served" />
      <Metric value="98%" label="Accuracy" />
      <Metric value="<2min" label="Processing" />
    </TrustIndicators>
  </MainContent>
  
  <InteractiveDemo>
    <TabSelector>
      <Tab active>Video Processing</Tab>
      <Tab>Image Analysis</Tab>
    </TabSelector>
    <DemoPlayer>
      <BeforeAfter>
        <Original />
        <Enhanced withAudioDescription />
      </BeforeAfter>
    </DemoPlayer>
  </InteractiveDemo>
</HeroSection>
```

### 1.2 Visual Design Specifications
```css
/* Hero Section Styling */
.hero-section {
  min-height: 100vh;
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.05) 0%,
    rgba(139, 92, 246, 0.05) 100%
  );
  position: relative;
  overflow: hidden;
}

/* Animated Background Elements */
.wave-pattern {
  position: absolute;
  opacity: 0.1;
  animation: wave-motion 20s ease-in-out infinite;
}

@keyframes wave-motion {
  0%, 100% { transform: translateX(0) translateY(0); }
  33% { transform: translateX(-20px) translateY(-10px); }
  66% { transform: translateX(20px) translateY(10px); }
}

/* Interactive Demo Container */
.interactive-demo {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.8);
  padding: 32px;
}
```

---

## 2. Dual-Mode Processing Interface

### 2.1 Unified Upload Component
```jsx
// Enhanced File Upload Interface
<ProcessingInterface>
  <ModeSelector>
    <ModeCard 
      active={mode === 'video'}
      icon={VideoIcon}
      title="Video Processing"
      description="Scene-by-scene analysis with timestamps"
      onClick={() => setMode('video')}
    />
    <ModeCard 
      active={mode === 'image'}
      icon={ImageIcon}
      title="Image Analysis"
      description="Detailed alt text and descriptions"
      onClick={() => setMode('image')}
    />
    <ModeCard 
      active={mode === 'batch'}
      icon={BatchIcon}
      title="Batch Processing"
      description="Process multiple files at once"
      onClick={() => setMode('batch')}
    />
  </ModeSelector>
  
  <UploadZone>
    <DropArea 
      onDrop={handleDrop}
      isDragging={isDragging}
      hasError={hasError}
    >
      <UploadIcon animate={isDragging} />
      <UploadText>
        {isDragging 
          ? "Drop your files here" 
          : "Drag & drop or click to browse"}
      </UploadText>
      <SupportedFormats>
        {mode === 'video' 
          ? ['MP4', 'MOV', 'AVI', 'MKV']
          : ['JPG', 'PNG', 'GIF', 'WebP']}
      </SupportedFormats>
    </DropArea>
    
    <ProcessingOptions>
      <OptionGroup label="Output Settings">
        <Select 
          label="Detail Level"
          options={['Basic', 'Detailed', 'Comprehensive']}
          icon={DetailIcon}
        />
        <Select 
          label="Language"
          options={languages}
          icon={LanguageIcon}
        />
      </OptionGroup>
      
      <OptionGroup label="Audio Settings">
        <Toggle 
          label="Generate Audio"
          checked={generateAudio}
          onChange={setGenerateAudio}
        />
        <Select 
          label="Voice"
          options={voices}
          disabled={!generateAudio}
          icon={VoiceIcon}
        />
        <Slider 
          label="Speech Rate"
          min={0.5}
          max={2}
          value={speechRate}
          disabled={!generateAudio}
        />
      </OptionGroup>
    </ProcessingOptions>
  </UploadZone>
  
  <ActionBar>
    <ProcessButton 
      onClick={startProcessing}
      loading={isProcessing}
      disabled={!hasFiles}
    >
      {isProcessing ? 'Processing...' : 'Generate Description'}
    </ProcessButton>
    <SecondaryActions>
      <Button variant="ghost" onClick={clearAll}>Clear All</Button>
      <Button variant="ghost" onClick={saveSettings}>Save Settings</Button>
    </SecondaryActions>
  </ActionBar>
</ProcessingInterface>
```

### 2.2 Real-time Processing Dashboard
```jsx
// Processing Status Dashboard
<ProcessingDashboard>
  <ProgressHeader>
    <Title>Processing Your {fileType}</Title>
    <StatusBadge status={currentStatus} />
    <Timer elapsed={elapsedTime} />
  </ProgressHeader>
  
  <PipelineVisualization>
    <PipelineStep 
      status="completed"
      icon={UploadIcon}
      title="Upload"
      description="File uploaded to S3"
      duration="2s"
    />
    <Connector status="completed" />
    
    <PipelineStep 
      status="active"
      icon={AnalyzeIcon}
      title="AI Analysis"
      description="Processing with Bedrock Nova Pro"
      progress={65}
      currentScene="3 of 5"
    />
    <Connector status="active" animated />
    
    <PipelineStep 
      status="pending"
      icon={AudioIcon}
      title="Audio Generation"
      description="Creating narration with Polly"
    />
  </PipelineVisualization>
  
  <MetricsGrid>
    <MetricCard
      icon={CPUIcon}
      label="Processing Power"
      value="High Performance"
      indicator="green"
    />
    <MetricCard
      icon={AccuracyIcon}
      label="Accuracy Score"
      value="98.5%"
      indicator="green"
    />
    <MetricCard
      icon={TimeIcon}
      label="Est. Completion"
      value="45 seconds"
      indicator="blue"
    />
  </MetricsGrid>
  
  <LivePreview>
    <PreviewHeader>Live Analysis Preview</PreviewHeader>
    <SceneCard>
      <SceneThumbnail src={currentFrame} />
      <SceneDescription>
        "A serene park entrance with tall oak trees framing
        a winding pathway. Sunlight filters through the leaves
        creating dappled shadows on the ground..."
      </SceneDescription>
    </SceneCard>
  </LivePreview>
</ProcessingDashboard>
```

---

## 3. Enhanced Results Display

### 3.1 Video Results Interface
```jsx
// Comprehensive Video Results
<VideoResults>
  <ResultsHeader>
    <Title>Your Video Description is Ready</Title>
    <QualityScore score={96} />
    <ShareOptions>
      <ShareButton platform="link" />
      <ShareButton platform="email" />
      <ShareButton platform="embed" />
    </ShareOptions>
  </ResultsHeader>
  
  <MainContent>
    <VideoPlayer>
      <VideoContainer>
        <Video src={originalVideo} />
        <AudioTrackIndicator active={hasAudioDescription} />
        <PlaybackControls>
          <PlayButton />
          <Timeline />
          <VolumeControl />
          <FullscreenButton />
        </PlaybackControls>
      </VideoContainer>
      
      <TranscriptPanel>
        <TranscriptHeader>
          <Title>Audio Description Transcript</Title>
          <SearchBar placeholder="Search transcript..." />
        </TranscriptHeader>
        <TimestampedTranscript>
          <TranscriptEntry 
            time="00:00-00:15"
            text="Opening scene: A serene park entrance..."
            playing={currentTime >= 0 && currentTime <= 15}
          />
          <TranscriptEntry 
            time="00:15-00:45"
            text="The camera pans across a winding pathway..."
            playing={currentTime >= 15 && currentTime <= 45}
          />
        </TimestampedTranscript>
      </TranscriptPanel>
    </VideoPlayer>
    
    <DownloadSection>
      <DownloadCard>
        <Icon>AudioFile</Icon>
        <Title>Audio Description</Title>
        <FormatOptions>
          <FormatButton format="MP3" size="2.3 MB" />
          <FormatButton format="WAV" size="8.1 MB" />
          <FormatButton format="M4A" size="1.9 MB" />
        </FormatOptions>
      </DownloadCard>
      
      <DownloadCard>
        <Icon>TextFile</Icon>
        <Title>Text Transcript</Title>
        <FormatOptions>
          <FormatButton format="TXT" size="12 KB" />
          <FormatButton format="SRT" size="15 KB" />
          <FormatButton format="VTT" size="14 KB" />
        </FormatOptions>
      </DownloadCard>
      
      <DownloadCard>
        <Icon>DataFile</Icon>
        <Title>Structured Data</Title>
        <FormatOptions>
          <FormatButton format="JSON" size="18 KB" />
          <FormatButton format="XML" size="22 KB" />
        </FormatOptions>
      </DownloadCard>
    </DownloadSection>
  </MainContent>
  
  <Analytics>
    <AnalyticsCard>
      <Title>Processing Analytics</Title>
      <Stats>
        <Stat label="Scenes Detected" value="8" />
        <Stat label="Words Generated" value="842" />
        <Stat label="Processing Time" value="1m 45s" />
        <Stat label="Accuracy Score" value="96%" />
      </Stats>
    </AnalyticsCard>
  </Analytics>
</VideoResults>
```

### 3.2 Image Results Gallery
```jsx
// Enhanced Image Results Display
<ImageResults>
  <ResultsHeader>
    <Title>Image Descriptions Generated</Title>
    <BatchInfo>6 of 6 images processed successfully</BatchInfo>
  </ResultsHeader>
  
  <ResultsGrid>
    {images.map(image => (
      <ImageCard key={image.id}>
        <ImagePreview>
          <Image src={image.url} alt={image.altText} />
          <ImageBadge>{image.format.toUpperCase()}</ImageBadge>
          <ExpandButton onClick={() => openLightbox(image)} />
        </ImagePreview>
        
        <DescriptionTabs>
          <Tab label="Alt Text" badge={image.altText.length}>
            <AltTextDisplay>{image.altText}</AltTextDisplay>
            <CopyButton text={image.altText} />
          </Tab>
          
          <Tab label="Full Description" badge={`${image.wordCount} words`}>
            <DescriptionDisplay>{image.fullDescription}</DescriptionDisplay>
            <ReadMoreButton />
          </Tab>
          
          <Tab label="Technical" badge="AI Analysis">
            <TechnicalDetails>
              <Detail label="Objects Detected" value={image.objects} />
              <Detail label="Scene Type" value={image.sceneType} />
              <Detail label="Dominant Colors" value={image.colors} />
            </TechnicalDetails>
          </Tab>
        </DescriptionTabs>
        
        <AudioPlayer>
          <PlayButton onClick={() => playAudio(image.audioUrl)} />
          <WaveformVisualizer />
          <Duration>{image.audioDuration}</Duration>
          <DownloadButton />
        </AudioPlayer>
      </ImageCard>
    ))}
  </ResultsGrid>
  
  <BulkActions>
    <Button icon="download">Download All Results</Button>
    <Button icon="code">Export as JSON</Button>
    <Button icon="report">Generate Accessibility Report</Button>
  </BulkActions>
</ImageResults>
```

---

## 4. API Documentation Portal

### 4.1 Interactive API Explorer
```jsx
// Developer-Friendly API Documentation
<APIDocumentation>
  <DocHeader>
    <Logo />
    <Navigation>
      <NavItem>Guides</NavItem>
      <NavItem>API Reference</NavItem>
      <NavItem>SDKs</NavItem>
      <NavItem>Examples</NavItem>
    </Navigation>
    <AuthStatus>
      <APIKeyIndicator active={hasKey} />
      <UserMenu />
    </AuthStatus>
  </DocHeader>
  
  <DocLayout>
    <Sidebar>
      <SearchInput placeholder="Search documentation..." />
      
      <NavSection title="Getting Started">
        <NavLink>Quick Start Guide</NavLink>
        <NavLink>Authentication</NavLink>
        <NavLink>Rate Limits</NavLink>
      </NavSection>
      
      <NavSection title="Endpoints">
        <NavGroup title="Video Processing">
          <NavLink method="POST">/api/video/upload</NavLink>
          <NavLink method="GET">/api/video/status</NavLink>
          <NavLink method="GET">/api/video/results</NavLink>
        </NavGroup>
        
        <NavGroup title="Image Processing">
          <NavLink method="POST">/api/image/process</NavLink>
          <NavLink method="POST">/api/image/batch</NavLink>
          <NavLink method="GET">/api/image/results</NavLink>
        </NavGroup>
      </NavSection>
    </Sidebar>
    
    <MainContent>
      <EndpointDoc>
        <EndpointHeader>
          <Method>POST</Method>
          <Path>/api/video/upload</Path>
          <Status>Stable</Status>
        </EndpointHeader>
        
        <Description>
          Upload a video file for audio description generation.
          Supports MP4, MOV, AVI formats up to 500MB.
        </Description>
        
        <InteractiveExample>
          <CodeTabs>
            <Tab label="cURL">
              <CodeBlock language="bash">
{`curl -X POST https://api.voicedesc.ai/v1/video/upload \\
  -H "X-API-Key: your_api_key" \\
  -F "video=@sample.mp4" \\
  -F "options={\"detail\":\"comprehensive\",\"language\":\"en\"}"`}
              </CodeBlock>
            </Tab>
            
            <Tab label="JavaScript">
              <CodeBlock language="javascript">
{`const formData = new FormData();
formData.append('video', videoFile);
formData.append('options', JSON.stringify({
  detail: 'comprehensive',
  language: 'en'
}));

const response = await fetch('https://api.voicedesc.ai/v1/video/upload', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_api_key'
  },
  body: formData
});`}
              </CodeBlock>
            </Tab>
            
            <Tab label="Python">
              <CodeBlock language="python">
{`import requests

files = {'video': open('sample.mp4', 'rb')}
data = {'options': json.dumps({
    'detail': 'comprehensive',
    'language': 'en'
})}

response = requests.post(
    'https://api.voicedesc.ai/v1/video/upload',
    headers={'X-API-Key': 'your_api_key'},
    files=files,
    data=data
)`}
              </CodeBlock>
            </Tab>
          </CodeTabs>
          
          <TryItOut>
            <InputField label="API Key" type="password" />
            <FileInput label="Video File" accept="video/*" />
            <OptionsBuilder>
              <Option name="detail" type="select" options={['basic', 'detailed', 'comprehensive']} />
              <Option name="language" type="select" options={languages} />
              <Option name="generateAudio" type="boolean" default={true} />
            </OptionsBuilder>
            <ExecuteButton onClick={executeRequest}>Send Request</ExecuteButton>
          </TryItOut>
          
          <ResponseViewer>
            <ResponseHeader status={200} time="245ms" />
            <JSONViewer data={sampleResponse} />
          </ResponseViewer>
        </InteractiveExample>
      </EndpointDoc>
    </MainContent>
  </DocLayout>
</APIDocumentation>
```

---

## 5. Accessibility-First Components

### 5.1 Screen Reader Optimized Components
```jsx
// Fully Accessible Upload Component
<AccessibleUpload>
  <div 
    role="region" 
    aria-label="File upload area"
    aria-describedby="upload-instructions"
  >
    <input
      type="file"
      id="file-input"
      className="sr-only"
      aria-label="Choose file to upload"
      aria-describedby="file-requirements"
      onChange={handleFileSelect}
      multiple={allowMultiple}
    />
    
    <label
      htmlFor="file-input"
      className="upload-dropzone"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="button"
      aria-label="Click or drag files here to upload"
    >
      <span id="upload-instructions" className="sr-only">
        Click to browse or drag and drop files here.
        Supported formats: {supportedFormats.join(', ')}.
        Maximum file size: {maxSize}MB.
      </span>
      
      <UploadIcon aria-hidden="true" />
      <p className="upload-text">Drop files or click to browse</p>
    </label>
    
    <div 
      id="file-requirements" 
      className="requirements-text"
      aria-live="polite"
    >
      {error && (
        <div role="alert" className="error-message">
          <ErrorIcon aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  </div>
  
  <div 
    role="status" 
    aria-live="polite" 
    aria-atomic="true"
    className="sr-only"
  >
    {uploadStatus}
  </div>
</AccessibleUpload>
```

### 5.2 Keyboard Navigation Patterns
```javascript
// Keyboard Navigation Implementation
const KeyboardNavigation = {
  // Focus management
  focusTrap: (container) => {
    const focusableElements = container.querySelectorAll(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    });
  },
  
  // Keyboard shortcuts
  shortcuts: {
    'Ctrl+U': 'Open upload dialog',
    'Ctrl+P': 'Start processing',
    'Ctrl+D': 'Download results',
    'Esc': 'Close modal/cancel operation',
    'Space': 'Play/pause media',
    '?': 'Show keyboard shortcuts help'
  },
  
  // Arrow key navigation for lists
  listNavigation: (list) => {
    const items = list.querySelectorAll('[role="option"]');
    let currentIndex = 0;
    
    list.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          currentIndex = Math.min(currentIndex + 1, items.length - 1);
          items[currentIndex].focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          currentIndex = Math.max(currentIndex - 1, 0);
          items[currentIndex].focus();
          break;
        case 'Home':
          e.preventDefault();
          currentIndex = 0;
          items[0].focus();
          break;
        case 'End':
          e.preventDefault();
          currentIndex = items.length - 1;
          items[currentIndex].focus();
          break;
      }
    });
  }
};
```

---

## 6. Mobile Experience

### 6.1 Touch-Optimized Interface
```jsx
// Mobile-First Components
<MobileInterface>
  <MobileHeader>
    <BurgerMenu onClick={toggleMenu} aria-label="Menu" />
    <Logo compact />
    <QuickActions>
      <IconButton icon="upload" aria-label="Upload" />
      <IconButton icon="notifications" aria-label="Notifications" />
    </QuickActions>
  </MobileHeader>
  
  <SwipeableViews>
    <View label="Upload">
      <MobileUploadZone>
        <LargeUploadButton>
          <CameraIcon />
          <Text>Take Photo/Video</Text>
        </LargeUploadButton>
        
        <LargeUploadButton>
          <GalleryIcon />
          <Text>Choose from Gallery</Text>
        </LargeUploadButton>
        
        <RecentFiles>
          <Title>Recent Uploads</Title>
          <FileList>
            {recentFiles.map(file => (
              <FileItem
                key={file.id}
                thumbnail={file.thumbnail}
                name={file.name}
                status={file.status}
                onClick={() => selectFile(file)}
              />
            ))}
          </FileList>
        </RecentFiles>
      </MobileUploadZone>
    </View>
    
    <View label="Processing">
      <ProcessingStatus>
        <CircularProgress value={progress} size="large" />
        <StatusText>{statusMessage}</StatusText>
        <TimeRemaining>{estimatedTime}</TimeRemaining>
      </ProcessingStatus>
    </View>
    
    <View label="Results">
      <ResultsView>
        <ResultCard>
          <MediaPreview src={result.preview} />
          <QuickActions>
            <ActionButton icon="play" label="Play Audio" />
            <ActionButton icon="download" label="Download" />
            <ActionButton icon="share" label="Share" />
          </QuickActions>
        </ResultCard>
      </ResultsView>
    </View>
  </SwipeableViews>
  
  <BottomNavigation>
    <NavItem icon="home" label="Home" active />
    <NavItem icon="upload" label="Upload" />
    <NavItem icon="history" label="History" />
    <NavItem icon="settings" label="Settings" />
  </BottomNavigation>
</MobileInterface>
```

### 6.2 Responsive Breakpoint System
```scss
// Responsive Design System
$breakpoints: (
  'xs': 375px,   // iPhone SE
  'sm': 640px,   // Large phones
  'md': 768px,   // Tablets
  'lg': 1024px,  // Small laptops
  'xl': 1280px,  // Desktops
  '2xl': 1536px  // Large screens
);

@mixin respond-to($breakpoint) {
  @media (min-width: map-get($breakpoints, $breakpoint)) {
    @content;
  }
}

// Component responsive adjustments
.upload-zone {
  padding: 1rem;
  
  @include respond-to('sm') {
    padding: 1.5rem;
  }
  
  @include respond-to('md') {
    padding: 2rem;
  }
  
  @include respond-to('lg') {
    padding: 3rem;
  }
}

.results-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  
  @include respond-to('sm') {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @include respond-to('lg') {
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  
  @include respond-to('xl') {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

---

## 7. Design Tokens & Variables

### 7.1 Comprehensive Token System
```javascript
// design-tokens.js
export const tokens = {
  // Spacing Scale
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },
  
  // Typography Scale
  typography: {
    fontFamily: {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      mono: 'JetBrains Mono, SF Mono, monospace',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
  },
  
  // Animation Tokens
  animation: {
    duration: {
      instant: '100ms',
      fast: '200ms',
      normal: '300ms',
      slow: '500ms',
      slower: '700ms',
    },
    easing: {
      linear: 'linear',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  
  // Shadow Scale
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },
  
  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  
  // Z-Index Scale
  zIndex: {
    auto: 'auto',
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
    dropdown: 1000,
    sticky: 1100,
    modal: 1300,
    popover: 1400,
    tooltip: 1500,
  },
};
```

---

## 8. Component Implementation Guide

### 8.1 React Component Structure
```jsx
// Example: Accessible Button Component
import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  ariaLabel,
  ariaDescribedBy,
  ...props
}, ref) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg focus:ring-blue-500',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500',
    ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-base rounded-lg',
    lg: 'px-6 py-3 text-lg rounded-xl',
  };
  
  const className = clsx(
    baseClasses,
    variants[variant],
    sizes[size],
    {
      'opacity-50 cursor-not-allowed': disabled || loading,
      'w-full': fullWidth,
    },
    props.className
  );
  
  return (
    <motion.button
      ref={ref}
      className={className}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={loading}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {icon && !loading && <span className="mr-2">{icon}</span>}
      {children}
    </motion.button>
  );
});

Button.displayName = 'Button';
```

### 8.2 Tailwind Configuration Extension
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        accent: {
          purple: '#8B5CF6',
          teal: '#14B8A6',
          amber: '#F59E0B',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'wave': 'wave 20s ease-in-out infinite',
        'blob': 'blob 7s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        wave: {
          '0%, 100%': { transform: 'translateX(0) translateY(0)' },
          '33%': { transform: 'translateX(-20px) translateY(-10px)' },
          '66%': { transform: 'translateX(20px) translateY(10px)' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
};
```

---

## Performance Optimization Guidelines

### Image Optimization
```javascript
// Next.js Image Optimization
import Image from 'next/image';

<Image
  src="/hero-image.jpg"
  alt="Voice Description API in action"
  width={1200}
  height={600}
  priority // Load immediately for above-the-fold content
  placeholder="blur"
  blurDataURL={blurDataUrl}
  quality={85}
  sizes="(max-width: 640px) 100vw,
         (max-width: 1024px) 50vw,
         33vw"
/>
```

### Code Splitting
```javascript
// Dynamic imports for heavy components
const ProcessingDashboard = dynamic(
  () => import('../components/ProcessingDashboard'),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
);

const ResultsDisplay = lazy(() => import('../components/ResultsDisplay'));
```

### Performance Metrics Target
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1
- Time to Interactive (TTI): < 3.8s
- Total Blocking Time (TBT): < 300ms

---

## Accessibility Compliance Checklist

### WCAG 2.1 AA Requirements
- [ ] All images have alt text
- [ ] Color contrast ratio ≥ 4.5:1 for normal text
- [ ] Color contrast ratio ≥ 3:1 for large text
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] Page has proper heading hierarchy
- [ ] Forms have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Dynamic content updates are announced
- [ ] Skip navigation links provided
- [ ] Touch targets are at least 44x44px
- [ ] Animations can be paused/stopped
- [ ] No seizure-inducing animations
- [ ] Content is responsive and reflows
- [ ] Text can be resized to 200% without loss of functionality

---

This comprehensive design specification provides everything needed to implement a modern, accessible, and user-friendly interface for the Voice Description API that showcases both video and image processing capabilities with enterprise-grade quality.