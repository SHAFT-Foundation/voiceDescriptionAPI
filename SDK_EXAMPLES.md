# Voice Description API - SDK Examples & Client Libraries

## Table of Contents
- [Go Client](#go-client)
- [Ruby Client](#ruby-client)
- [Java/Kotlin Client](#javakotlin-client)
- [C# / .NET Client](#c--net-client)
- [PHP Client](#php-client)
- [Swift/iOS Client](#swiftios-client)
- [Rust Client](#rust-client)
- [Shell Script Utilities](#shell-script-utilities)
- [GraphQL Wrapper](#graphql-wrapper)
- [Advanced Patterns](#advanced-patterns)

## Go Client

```go
package voicedescription

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "mime/multipart"
    "net/http"
    "os"
    "time"
)

// Client represents the Voice Description API client
type Client struct {
    BaseURL    string
    HTTPClient *http.Client
    APIKey     string
}

// NewClient creates a new API client
func NewClient(baseURL, apiKey string) *Client {
    return &Client{
        BaseURL: baseURL,
        HTTPClient: &http.Client{
            Timeout: 30 * time.Second,
        },
        APIKey: apiKey,
    }
}

// UploadResponse represents the upload API response
type UploadResponse struct {
    Success bool   `json:"success"`
    JobID   string `json:"jobId"`
    Message string `json:"message"`
}

// JobStatus represents the job status
type JobStatus struct {
    JobID    string `json:"jobId"`
    Status   string `json:"status"`
    Step     string `json:"step"`
    Progress int    `json:"progress"`
    Message  string `json:"message"`
    Results  struct {
        TextURL  string `json:"textUrl"`
        AudioURL string `json:"audioUrl"`
    } `json:"results"`
}

// ProcessingOptions represents processing configuration
type ProcessingOptions struct {
    DetailLevel   string `json:"detailLevel,omitempty"`
    GenerateAudio bool   `json:"generateAudio,omitempty"`
    VoiceID       string `json:"voiceId,omitempty"`
    Language      string `json:"language,omitempty"`
}

// UploadFile uploads a file for processing
func (c *Client) UploadFile(filePath string, fileType string, options ProcessingOptions) (*UploadResponse, error) {
    file, err := os.Open(filePath)
    if err != nil {
        return nil, fmt.Errorf("failed to open file: %w", err)
    }
    defer file.Close()

    // Create multipart form
    body := &bytes.Buffer{}
    writer := multipart.NewWriter(body)

    // Add file
    part, err := writer.CreateFormFile("file", filePath)
    if err != nil {
        return nil, fmt.Errorf("failed to create form file: %w", err)
    }
    
    if _, err := io.Copy(part, file); err != nil {
        return nil, fmt.Errorf("failed to copy file: %w", err)
    }

    // Add type field
    if err := writer.WriteField("type", fileType); err != nil {
        return nil, fmt.Errorf("failed to write type field: %w", err)
    }

    // Add options
    if options.DetailLevel != "" {
        writer.WriteField("detailLevel", options.DetailLevel)
    }
    if options.GenerateAudio {
        writer.WriteField("generateAudio", "true")
    }
    if options.VoiceID != "" {
        writer.WriteField("voiceId", options.VoiceID)
    }

    if err := writer.Close(); err != nil {
        return nil, fmt.Errorf("failed to close writer: %w", err)
    }

    // Create request
    req, err := http.NewRequest("POST", c.BaseURL+"/api/upload", body)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }

    req.Header.Set("Content-Type", writer.FormDataContentType())
    if c.APIKey != "" {
        req.Header.Set("Authorization", "Bearer "+c.APIKey)
    }

    // Send request
    resp, err := c.HTTPClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    // Parse response
    var uploadResp UploadResponse
    if err := json.NewDecoder(resp.Body).Decode(&uploadResp); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &uploadResp, nil
}

// GetJobStatus retrieves the status of a job
func (c *Client) GetJobStatus(jobID string, jobType string) (*JobStatus, error) {
    endpoint := fmt.Sprintf("/api/status/%s", jobID)
    if jobType == "image" {
        endpoint = fmt.Sprintf("/api/status/image/%s", jobID)
    }

    req, err := http.NewRequest("GET", c.BaseURL+endpoint, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }

    if c.APIKey != "" {
        req.Header.Set("Authorization", "Bearer "+c.APIKey)
    }

    resp, err := c.HTTPClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    var status JobStatus
    if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
        return nil, fmt.Errorf("failed to decode response: %w", err)
    }

    return &status, nil
}

// WaitForCompletion polls job status until completion
func (c *Client) WaitForCompletion(jobID string, jobType string) (*JobStatus, error) {
    maxAttempts := 60
    interval := 2 * time.Second

    for i := 0; i < maxAttempts; i++ {
        status, err := c.GetJobStatus(jobID, jobType)
        if err != nil {
            return nil, err
        }

        switch status.Status {
        case "completed":
            return status, nil
        case "failed":
            return nil, fmt.Errorf("job failed: %s", status.Message)
        }

        fmt.Printf("Progress: %d%% - %s\n", status.Progress, status.Message)
        time.Sleep(interval)
        
        // Exponential backoff
        if interval < 30*time.Second {
            interval = time.Duration(float64(interval) * 1.5)
        }
    }

    return nil, fmt.Errorf("job timed out")
}

// DownloadResults downloads job results
func (c *Client) DownloadResults(jobID string, resultType string, jobType string) ([]byte, error) {
    endpoint := fmt.Sprintf("/api/results/%s/%s", jobID, resultType)
    if jobType == "image" {
        endpoint = fmt.Sprintf("/api/results/image/%s/%s", jobID, resultType)
    }

    req, err := http.NewRequest("GET", c.BaseURL+endpoint, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }

    if c.APIKey != "" {
        req.Header.Set("Authorization", "Bearer "+c.APIKey)
    }

    resp, err := c.HTTPClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    return io.ReadAll(resp.Body)
}

// Example usage
func ExampleUsage() {
    client := NewClient("http://localhost:3000", "your-api-key")

    // Upload video
    resp, err := client.UploadFile("video.mp4", "video", ProcessingOptions{
        DetailLevel:   "comprehensive",
        GenerateAudio: true,
        VoiceID:      "Joanna",
    })
    if err != nil {
        panic(err)
    }

    fmt.Printf("Job started: %s\n", resp.JobID)

    // Wait for completion
    status, err := client.WaitForCompletion(resp.JobID, "video")
    if err != nil {
        panic(err)
    }

    fmt.Printf("Job completed: %+v\n", status)

    // Download results
    textData, _ := client.DownloadResults(resp.JobID, "text", "video")
    audioData, _ := client.DownloadResults(resp.JobID, "audio", "video")

    // Save to files
    os.WriteFile("description.txt", textData, 0644)
    os.WriteFile("narration.mp3", audioData, 0644)
}
```

## Ruby Client

```ruby
require 'net/http'
require 'uri'
require 'json'
require 'base64'

class VoiceDescriptionClient
  attr_accessor :base_url, :api_key

  def initialize(base_url = 'http://localhost:3000', api_key = nil)
    @base_url = base_url
    @api_key = api_key
  end

  # Upload a file for processing
  def upload_file(file_path, type, options = {})
    uri = URI("#{@base_url}/api/upload")
    
    request = Net::HTTP::Post.new(uri)
    request['Authorization'] = "Bearer #{@api_key}" if @api_key
    
    form_data = [
      ['file', File.open(file_path)],
      ['type', type]
    ]
    
    # Add options to form data
    options.each do |key, value|
      form_data << [key.to_s, value.to_s]
    end
    
    request.set_form form_data, 'multipart/form-data'
    
    response = Net::HTTP.start(uri.hostname, uri.port) do |http|
      http.request(request)
    end
    
    JSON.parse(response.body)
  end

  # Process a single image
  def process_image(image_path, options = {})
    uri = URI("#{@base_url}/api/process-image")
    
    request = Net::HTTP::Post.new(uri)
    request['Authorization'] = "Bearer #{@api_key}" if @api_key
    
    form_data = [['file', File.open(image_path)]]
    
    options.each do |key, value|
      form_data << [key.to_s, value.to_s]
    end
    
    request.set_form form_data, 'multipart/form-data'
    
    response = Net::HTTP.start(uri.hostname, uri.port) do |http|
      http.request(request)
    end
    
    JSON.parse(response.body)
  end

  # Process batch images
  def process_batch_images(image_paths, options = {})
    uri = URI("#{@base_url}/api/process-images-batch")
    
    images = image_paths.map do |path|
      content = File.read(path, mode: 'rb')
      encoded = Base64.strict_encode64(content)
      mime_type = get_mime_type(path)
      
      {
        source: "data:#{mime_type};base64,#{encoded}",
        id: File.basename(path),
        metadata: {
          title: File.basename(path, '.*')
        }
      }
    end
    
    payload = {
      images: images,
      options: options
    }
    
    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    request['Authorization'] = "Bearer #{@api_key}" if @api_key
    request.body = payload.to_json
    
    response = Net::HTTP.start(uri.hostname, uri.port) do |http|
      http.request(request)
    end
    
    JSON.parse(response.body)
  end

  # Get job status
  def get_job_status(job_id, type = 'video')
    endpoint = type == 'image' ? 
      "/api/status/image/#{job_id}" : 
      "/api/status/#{job_id}"
    
    uri = URI("#{@base_url}#{endpoint}")
    
    request = Net::HTTP::Get.new(uri)
    request['Authorization'] = "Bearer #{@api_key}" if @api_key
    
    response = Net::HTTP.start(uri.hostname, uri.port) do |http|
      http.request(request)
    end
    
    JSON.parse(response.body)
  end

  # Wait for job completion
  def wait_for_completion(job_id, type = 'video', max_attempts = 60)
    interval = 2
    
    max_attempts.times do
      status = get_job_status(job_id, type)
      
      case status['status']
      when 'completed'
        return status
      when 'failed'
        raise "Job failed: #{status['message']}"
      end
      
      puts "Progress: #{status['progress']}% - #{status['message']}"
      sleep(interval)
      
      # Exponential backoff
      interval = [interval * 1.5, 30].min
    end
    
    raise 'Job timed out'
  end

  # Download results
  def download_results(job_id, result_type, job_type = 'video', output_path = nil)
    endpoint = job_type == 'image' ?
      "/api/results/image/#{job_id}/#{result_type}" :
      "/api/results/#{job_id}/#{result_type}"
    
    uri = URI("#{@base_url}#{endpoint}")
    
    request = Net::HTTP::Get.new(uri)
    request['Authorization'] = "Bearer #{@api_key}" if @api_key
    
    response = Net::HTTP.start(uri.hostname, uri.port) do |http|
      http.request(request)
    end
    
    if output_path
      File.write(output_path, response.body, mode: 'wb')
      return output_path
    end
    
    response.body
  end

  # Check API health
  def check_health
    uri = URI("#{@base_url}/api/health")
    response = Net::HTTP.get_response(uri)
    JSON.parse(response.body)
  end

  private

  def get_mime_type(file_path)
    ext = File.extname(file_path).downcase
    
    mime_types = {
      '.jpg' => 'image/jpeg',
      '.jpeg' => 'image/jpeg',
      '.png' => 'image/png',
      '.gif' => 'image/gif',
      '.webp' => 'image/webp',
      '.mp4' => 'video/mp4',
      '.avi' => 'video/avi',
      '.mov' => 'video/quicktime'
    }
    
    mime_types[ext] || 'application/octet-stream'
  end
end

# Example usage
client = VoiceDescriptionClient.new('http://localhost:3000', 'your-api-key')

# Check health
health = client.check_health
puts "API Status: #{health['status']}"

# Process video
result = client.upload_file('video.mp4', 'video', {
  detailLevel: 'comprehensive',
  voiceId: 'Joanna'
})

puts "Job ID: #{result['jobId']}"

# Wait for completion
final_status = client.wait_for_completion(result['jobId'])

# Download results
client.download_results(result['jobId'], 'text', 'video', 'description.txt')
client.download_results(result['jobId'], 'audio', 'video', 'narration.mp3')

puts "Processing complete!"
```

## Java/Kotlin Client

### Java Implementation

```java
package com.voicedescription.api;

import okhttp3.*;
import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.Map;
import java.util.HashMap;

public class VoiceDescriptionClient {
    private final String baseUrl;
    private final String apiKey;
    private final OkHttpClient httpClient;
    private final Gson gson;

    public VoiceDescriptionClient(String baseUrl, String apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.gson = new Gson();
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();
    }

    // Response classes
    public static class UploadResponse {
        @SerializedName("success")
        public boolean success;
        
        @SerializedName("jobId")
        public String jobId;
        
        @SerializedName("message")
        public String message;
    }

    public static class JobStatus {
        @SerializedName("jobId")
        public String jobId;
        
        @SerializedName("status")
        public String status;
        
        @SerializedName("step")
        public String step;
        
        @SerializedName("progress")
        public int progress;
        
        @SerializedName("message")
        public String message;
        
        @SerializedName("results")
        public Results results;
        
        public static class Results {
            @SerializedName("textUrl")
            public String textUrl;
            
            @SerializedName("audioUrl")
            public String audioUrl;
        }
    }

    public static class ProcessingOptions {
        public String detailLevel;
        public boolean generateAudio;
        public String voiceId;
        public String language;

        public static class Builder {
            private String detailLevel = "basic";
            private boolean generateAudio = true;
            private String voiceId = "Joanna";
            private String language = "en";

            public Builder detailLevel(String level) {
                this.detailLevel = level;
                return this;
            }

            public Builder generateAudio(boolean generate) {
                this.generateAudio = generate;
                return this;
            }

            public Builder voiceId(String id) {
                this.voiceId = id;
                return this;
            }

            public Builder language(String lang) {
                this.language = lang;
                return this;
            }

            public ProcessingOptions build() {
                ProcessingOptions options = new ProcessingOptions();
                options.detailLevel = detailLevel;
                options.generateAudio = generateAudio;
                options.voiceId = voiceId;
                options.language = language;
                return options;
            }
        }
    }

    // Upload file
    public UploadResponse uploadFile(File file, String type, ProcessingOptions options) 
            throws IOException {
        
        MultipartBody.Builder builder = new MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", file.getName(),
                RequestBody.create(file, MediaType.parse("application/octet-stream")))
            .addFormDataPart("type", type);

        // Add options
        if (options != null) {
            builder.addFormDataPart("detailLevel", options.detailLevel);
            builder.addFormDataPart("generateAudio", String.valueOf(options.generateAudio));
            builder.addFormDataPart("voiceId", options.voiceId);
            builder.addFormDataPart("language", options.language);
        }

        RequestBody requestBody = builder.build();

        Request.Builder requestBuilder = new Request.Builder()
            .url(baseUrl + "/api/upload")
            .post(requestBody);

        if (apiKey != null) {
            requestBuilder.addHeader("Authorization", "Bearer " + apiKey);
        }

        Request request = requestBuilder.build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Unexpected response: " + response);
            }

            String responseBody = response.body().string();
            return gson.fromJson(responseBody, UploadResponse.class);
        }
    }

    // Get job status
    public JobStatus getJobStatus(String jobId, String jobType) throws IOException {
        String endpoint = "image".equals(jobType) 
            ? "/api/status/image/" + jobId
            : "/api/status/" + jobId;

        Request.Builder requestBuilder = new Request.Builder()
            .url(baseUrl + endpoint)
            .get();

        if (apiKey != null) {
            requestBuilder.addHeader("Authorization", "Bearer " + apiKey);
        }

        Request request = requestBuilder.build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Unexpected response: " + response);
            }

            String responseBody = response.body().string();
            return gson.fromJson(responseBody, JobStatus.class);
        }
    }

    // Wait for completion
    public JobStatus waitForCompletion(String jobId, String jobType) 
            throws IOException, InterruptedException {
        
        int maxAttempts = 60;
        long interval = 2000; // 2 seconds

        for (int i = 0; i < maxAttempts; i++) {
            JobStatus status = getJobStatus(jobId, jobType);

            if ("completed".equals(status.status)) {
                return status;
            } else if ("failed".equals(status.status)) {
                throw new RuntimeException("Job failed: " + status.message);
            }

            System.out.printf("Progress: %d%% - %s%n", status.progress, status.message);
            Thread.sleep(interval);

            // Exponential backoff
            interval = Math.min((long)(interval * 1.5), 30000);
        }

        throw new RuntimeException("Job timed out");
    }

    // Download results
    public byte[] downloadResults(String jobId, String resultType, String jobType) 
            throws IOException {
        
        String endpoint = "image".equals(jobType)
            ? String.format("/api/results/image/%s/%s", jobId, resultType)
            : String.format("/api/results/%s/%s", jobId, resultType);

        Request.Builder requestBuilder = new Request.Builder()
            .url(baseUrl + endpoint)
            .get();

        if (apiKey != null) {
            requestBuilder.addHeader("Authorization", "Bearer " + apiKey);
        }

        Request request = requestBuilder.build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Unexpected response: " + response);
            }

            return response.body().bytes();
        }
    }

    // Example usage
    public static void main(String[] args) {
        VoiceDescriptionClient client = new VoiceDescriptionClient(
            "http://localhost:3000",
            "your-api-key"
        );

        try {
            // Build processing options
            ProcessingOptions options = new ProcessingOptions.Builder()
                .detailLevel("comprehensive")
                .generateAudio(true)
                .voiceId("Joanna")
                .build();

            // Upload file
            File videoFile = new File("video.mp4");
            UploadResponse uploadResponse = client.uploadFile(videoFile, "video", options);
            
            System.out.println("Job ID: " + uploadResponse.jobId);

            // Wait for completion
            JobStatus finalStatus = client.waitForCompletion(uploadResponse.jobId, "video");
            
            System.out.println("Job completed!");

            // Download results
            byte[] textData = client.downloadResults(uploadResponse.jobId, "text", "video");
            byte[] audioData = client.downloadResults(uploadResponse.jobId, "audio", "video");

            // Save to files
            java.nio.file.Files.write(
                java.nio.file.Paths.get("description.txt"), 
                textData
            );
            java.nio.file.Files.write(
                java.nio.file.Paths.get("narration.mp3"), 
                audioData
            );

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

### Kotlin Implementation

```kotlin
package com.voicedescription.api

import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.io.File
import java.io.IOException
import kotlin.coroutines.suspendCoroutine

class VoiceDescriptionClient(
    private val baseUrl: String = "http://localhost:3000",
    private val apiKey: String? = null
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .build()
    
    private val gson = Gson()

    // Data classes
    data class UploadResponse(
        @SerializedName("success") val success: Boolean,
        @SerializedName("jobId") val jobId: String,
        @SerializedName("message") val message: String?
    )

    data class JobStatus(
        @SerializedName("jobId") val jobId: String,
        @SerializedName("status") val status: String,
        @SerializedName("step") val step: String,
        @SerializedName("progress") val progress: Int,
        @SerializedName("message") val message: String?,
        @SerializedName("results") val results: Results?
    ) {
        data class Results(
            @SerializedName("textUrl") val textUrl: String?,
            @SerializedName("audioUrl") val audioUrl: String?
        )
    }

    data class ProcessingOptions(
        val detailLevel: String = "basic",
        val generateAudio: Boolean = true,
        val voiceId: String = "Joanna",
        val language: String = "en"
    )

    // Upload file with coroutines
    suspend fun uploadFile(
        file: File,
        type: String,
        options: ProcessingOptions = ProcessingOptions()
    ): UploadResponse = withContext(Dispatchers.IO) {
        
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart(
                "file",
                file.name,
                file.asRequestBody("application/octet-stream".toMediaType())
            )
            .addFormDataPart("type", type)
            .addFormDataPart("detailLevel", options.detailLevel)
            .addFormDataPart("generateAudio", options.generateAudio.toString())
            .addFormDataPart("voiceId", options.voiceId)
            .addFormDataPart("language", options.language)
            .build()

        val request = Request.Builder()
            .url("$baseUrl/api/upload")
            .post(requestBody)
            .apply {
                apiKey?.let { addHeader("Authorization", "Bearer $it") }
            }
            .build()

        suspendCoroutine { continuation ->
            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    continuation.resumeWith(Result.failure(e))
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        if (!response.isSuccessful) {
                            continuation.resumeWith(
                                Result.failure(IOException("Unexpected code $response"))
                            )
                        } else {
                            val responseBody = response.body?.string()
                            val uploadResponse = gson.fromJson(
                                responseBody,
                                UploadResponse::class.java
                            )
                            continuation.resumeWith(Result.success(uploadResponse))
                        }
                    }
                }
            })
        }
    }

    // Get job status
    suspend fun getJobStatus(jobId: String, jobType: String = "video"): JobStatus = 
        withContext(Dispatchers.IO) {
            val endpoint = if (jobType == "image") {
                "/api/status/image/$jobId"
            } else {
                "/api/status/$jobId"
            }

            val request = Request.Builder()
                .url("$baseUrl$endpoint")
                .get()
                .apply {
                    apiKey?.let { addHeader("Authorization", "Bearer $it") }
                }
                .build()

            val response = client.newCall(request).execute()
            response.use {
                if (!response.isSuccessful) {
                    throw IOException("Unexpected code $response")
                }
                
                val responseBody = response.body?.string()
                gson.fromJson(responseBody, JobStatus::class.java)
            }
        }

    // Wait for completion with progress updates
    suspend fun waitForCompletion(
        jobId: String,
        jobType: String = "video",
        onProgress: ((JobStatus) -> Unit)? = null
    ): JobStatus = coroutineScope {
        
        var attempts = 0
        val maxAttempts = 60
        var interval = 2000L

        while (attempts < maxAttempts) {
            val status = getJobStatus(jobId, jobType)
            onProgress?.invoke(status)

            when (status.status) {
                "completed" -> return@coroutineScope status
                "failed" -> throw RuntimeException("Job failed: ${status.message}")
            }

            delay(interval)
            attempts++
            
            // Exponential backoff
            interval = minOf((interval * 1.5).toLong(), 30000L)
        }

        throw RuntimeException("Job timed out")
    }

    // Download results
    suspend fun downloadResults(
        jobId: String,
        resultType: String,
        jobType: String = "video"
    ): ByteArray = withContext(Dispatchers.IO) {
        
        val endpoint = if (jobType == "image") {
            "/api/results/image/$jobId/$resultType"
        } else {
            "/api/results/$jobId/$resultType"
        }

        val request = Request.Builder()
            .url("$baseUrl$endpoint")
            .get()
            .apply {
                apiKey?.let { addHeader("Authorization", "Bearer $it") }
            }
            .build()

        val response = client.newCall(request).execute()
        response.use {
            if (!response.isSuccessful) {
                throw IOException("Unexpected code $response")
            }
            
            response.body?.bytes() ?: throw IOException("Empty response body")
        }
    }

    // Process multiple files concurrently
    suspend fun processBatch(
        files: List<File>,
        type: String,
        options: ProcessingOptions = ProcessingOptions(),
        concurrency: Int = 3
    ): List<JobStatus> = coroutineScope {
        
        val semaphore = kotlinx.coroutines.sync.Semaphore(concurrency)
        
        files.map { file ->
            async {
                semaphore.withPermit {
                    val uploadResponse = uploadFile(file, type, options)
                    waitForCompletion(uploadResponse.jobId, type) { status ->
                        println("${file.name}: ${status.progress}% - ${status.message}")
                    }
                }
            }
        }.awaitAll()
    }
}

// Usage example
fun main() = runBlocking {
    val client = VoiceDescriptionClient(
        baseUrl = "http://localhost:3000",
        apiKey = "your-api-key"
    )

    try {
        // Process video
        val videoFile = File("video.mp4")
        val options = VoiceDescriptionClient.ProcessingOptions(
            detailLevel = "comprehensive",
            generateAudio = true,
            voiceId = "Joanna"
        )

        val uploadResponse = client.uploadFile(videoFile, "video", options)
        println("Job started: ${uploadResponse.jobId}")

        // Wait with progress updates
        val finalStatus = client.waitForCompletion(uploadResponse.jobId) { status ->
            println("Progress: ${status.progress}% - ${status.message}")
        }

        println("Processing complete!")

        // Download results
        val textData = client.downloadResults(uploadResponse.jobId, "text")
        val audioData = client.downloadResults(uploadResponse.jobId, "audio")

        // Save files
        File("description.txt").writeBytes(textData)
        File("narration.mp3").writeBytes(audioData)

        // Process multiple images concurrently
        val imageFiles = listOf(
            File("image1.jpg"),
            File("image2.jpg"),
            File("image3.jpg")
        )

        val results = client.processBatch(imageFiles, "image", concurrency = 2)
        println("Processed ${results.size} images")

    } catch (e: Exception) {
        println("Error: ${e.message}")
    }
}
```

## C# / .NET Client

```csharp
using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace VoiceDescription.SDK
{
    public class VoiceDescriptionClient : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;
        private readonly string _apiKey;
        private readonly JsonSerializerOptions _jsonOptions;

        public VoiceDescriptionClient(string baseUrl = "http://localhost:3000", string apiKey = null)
        {
            _baseUrl = baseUrl;
            _apiKey = apiKey;
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            
            if (!string.IsNullOrEmpty(_apiKey))
            {
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", _apiKey);
            }

            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                PropertyNameCaseInsensitive = true
            };
        }

        // Response models
        public class UploadResponse
        {
            public bool Success { get; set; }
            public string JobId { get; set; }
            public string Message { get; set; }
        }

        public class JobStatus
        {
            public string JobId { get; set; }
            public string Status { get; set; }
            public string Step { get; set; }
            public int Progress { get; set; }
            public string Message { get; set; }
            public JobResults Results { get; set; }

            public class JobResults
            {
                public string TextUrl { get; set; }
                public string AudioUrl { get; set; }
            }
        }

        public class ProcessingOptions
        {
            public string DetailLevel { get; set; } = "basic";
            public bool GenerateAudio { get; set; } = true;
            public string VoiceId { get; set; } = "Joanna";
            public string Language { get; set; } = "en";
        }

        // Upload file
        public async Task<UploadResponse> UploadFileAsync(
            string filePath, 
            string type, 
            ProcessingOptions options = null,
            IProgress<int> uploadProgress = null)
        {
            using var form = new MultipartFormDataContent();
            using var fileStream = File.OpenRead(filePath);
            
            // Track upload progress
            var progressContent = new ProgressStreamContent(fileStream, uploadProgress);
            form.Add(progressContent, "file", Path.GetFileName(filePath));
            form.Add(new StringContent(type), "type");

            if (options != null)
            {
                form.Add(new StringContent(options.DetailLevel), "detailLevel");
                form.Add(new StringContent(options.GenerateAudio.ToString()), "generateAudio");
                form.Add(new StringContent(options.VoiceId), "voiceId");
                form.Add(new StringContent(options.Language), "language");
            }

            var response = await _httpClient.PostAsync($"{_baseUrl}/api/upload", form);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<UploadResponse>(json, _jsonOptions);
        }

        // Process single image
        public async Task<UploadResponse> ProcessImageAsync(
            string imagePath,
            ProcessingOptions options = null)
        {
            using var form = new MultipartFormDataContent();
            using var fileStream = File.OpenRead(imagePath);
            
            form.Add(new StreamContent(fileStream), "file", Path.GetFileName(imagePath));

            if (options != null)
            {
                form.Add(new StringContent(options.DetailLevel), "detailLevel");
                form.Add(new StringContent(options.GenerateAudio.ToString()), "generateAudio");
                form.Add(new StringContent(options.VoiceId), "voiceId");
            }

            var response = await _httpClient.PostAsync($"{_baseUrl}/api/process-image", form);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<UploadResponse>(json, _jsonOptions);
        }

        // Get job status
        public async Task<JobStatus> GetJobStatusAsync(string jobId, string jobType = "video")
        {
            var endpoint = jobType == "image" 
                ? $"/api/status/image/{jobId}" 
                : $"/api/status/{jobId}";

            var response = await _httpClient.GetAsync($"{_baseUrl}{endpoint}");
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<JobStatus>(json, _jsonOptions);
        }

        // Wait for completion
        public async Task<JobStatus> WaitForCompletionAsync(
            string jobId,
            string jobType = "video",
            IProgress<JobStatus> progress = null,
            CancellationToken cancellationToken = default)
        {
            var maxAttempts = 60;
            var interval = TimeSpan.FromSeconds(2);

            for (int i = 0; i < maxAttempts; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var status = await GetJobStatusAsync(jobId, jobType);
                progress?.Report(status);

                switch (status.Status)
                {
                    case "completed":
                        return status;
                    case "failed":
                        throw new Exception($"Job failed: {status.Message}");
                }

                await Task.Delay(interval, cancellationToken);
                
                // Exponential backoff
                interval = TimeSpan.FromSeconds(Math.Min(interval.TotalSeconds * 1.5, 30));
            }

            throw new TimeoutException("Job processing timed out");
        }

        // Download results
        public async Task<byte[]> DownloadResultsAsync(
            string jobId,
            string resultType,
            string jobType = "video")
        {
            var endpoint = jobType == "image"
                ? $"/api/results/image/{jobId}/{resultType}"
                : $"/api/results/{jobId}/{resultType}";

            var response = await _httpClient.GetAsync($"{_baseUrl}{endpoint}");
            response.EnsureSuccessStatusCode();

            return await response.Content.ReadAsByteArrayAsync();
        }

        // Batch processing
        public async Task<List<JobStatus>> ProcessBatchAsync(
            IEnumerable<string> filePaths,
            string type,
            ProcessingOptions options = null,
            int maxConcurrency = 3)
        {
            var semaphore = new SemaphoreSlim(maxConcurrency);
            var tasks = new List<Task<JobStatus>>();

            foreach (var filePath in filePaths)
            {
                tasks.Add(ProcessFileWithSemaphoreAsync(
                    filePath, type, options, semaphore));
            }

            return new List<JobStatus>(await Task.WhenAll(tasks));
        }

        private async Task<JobStatus> ProcessFileWithSemaphoreAsync(
            string filePath,
            string type,
            ProcessingOptions options,
            SemaphoreSlim semaphore)
        {
            await semaphore.WaitAsync();
            try
            {
                var uploadResponse = await UploadFileAsync(filePath, type, options);
                return await WaitForCompletionAsync(uploadResponse.JobId, type);
            }
            finally
            {
                semaphore.Release();
            }
        }

        public void Dispose()
        {
            _httpClient?.Dispose();
        }
    }

    // Progress tracking for uploads
    public class ProgressStreamContent : StreamContent
    {
        private readonly IProgress<int> _progress;
        private readonly Stream _stream;

        public ProgressStreamContent(Stream stream, IProgress<int> progress) : base(stream)
        {
            _stream = stream;
            _progress = progress;
        }

        protected override async Task SerializeToStreamAsync(
            Stream stream, 
            TransportContext context)
        {
            var buffer = new byte[8192];
            var totalBytes = _stream.Length;
            var bytesRead = 0L;

            while (true)
            {
                var count = await _stream.ReadAsync(buffer, 0, buffer.Length);
                if (count == 0) break;

                await stream.WriteAsync(buffer, 0, count);
                bytesRead += count;

                _progress?.Report((int)((bytesRead * 100) / totalBytes));
            }
        }
    }

    // Example usage
    class Program
    {
        static async Task Main(string[] args)
        {
            using var client = new VoiceDescriptionClient(
                "http://localhost:3000",
                "your-api-key"
            );

            try
            {
                // Upload with progress tracking
                var uploadProgress = new Progress<int>(percent =>
                {
                    Console.WriteLine($"Upload progress: {percent}%");
                });

                var options = new VoiceDescriptionClient.ProcessingOptions
                {
                    DetailLevel = "comprehensive",
                    GenerateAudio = true,
                    VoiceId = "Joanna"
                };

                var uploadResponse = await client.UploadFileAsync(
                    "video.mp4",
                    "video",
                    options,
                    uploadProgress
                );

                Console.WriteLine($"Job started: {uploadResponse.JobId}");

                // Wait with status updates
                var statusProgress = new Progress<VoiceDescriptionClient.JobStatus>(status =>
                {
                    Console.WriteLine($"Progress: {status.Progress}% - {status.Message}");
                });

                var finalStatus = await client.WaitForCompletionAsync(
                    uploadResponse.JobId,
                    "video",
                    statusProgress
                );

                Console.WriteLine("Processing complete!");

                // Download results
                var textData = await client.DownloadResultsAsync(
                    uploadResponse.JobId, "text");
                var audioData = await client.DownloadResultsAsync(
                    uploadResponse.JobId, "audio");

                // Save files
                await File.WriteAllBytesAsync("description.txt", textData);
                await File.WriteAllBytesAsync("narration.mp3", audioData);

                // Batch processing
                var files = new[] { "image1.jpg", "image2.jpg", "image3.jpg" };
                var batchResults = await client.ProcessBatchAsync(
                    files, "image", options, maxConcurrency: 2);

                Console.WriteLine($"Processed {batchResults.Count} files");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
        }
    }
}
```

## PHP Client

```php
<?php

class VoiceDescriptionClient {
    private $baseUrl;
    private $apiKey;

    public function __construct($baseUrl = 'http://localhost:3000', $apiKey = null) {
        $this->baseUrl = $baseUrl;
        $this->apiKey = $apiKey;
    }

    /**
     * Upload a file for processing
     */
    public function uploadFile($filePath, $type, $options = []) {
        $url = $this->baseUrl . '/api/upload';
        
        $postData = [
            'file' => new CURLFile($filePath),
            'type' => $type
        ];
        
        // Add options
        foreach ($options as $key => $value) {
            $postData[$key] = $value;
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        if ($this->apiKey) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $this->apiKey
            ]);
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Upload failed with status ' . $httpCode);
        }
        
        return json_decode($response, true);
    }

    /**
     * Process a single image
     */
    public function processImage($imagePath, $options = []) {
        $url = $this->baseUrl . '/api/process-image';
        
        $postData = ['file' => new CURLFile($imagePath)];
        
        foreach ($options as $key => $value) {
            $postData[$key] = $value;
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        if ($this->apiKey) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $this->apiKey
            ]);
        }
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        return json_decode($response, true);
    }

    /**
     * Get job status
     */
    public function getJobStatus($jobId, $jobType = 'video') {
        $endpoint = $jobType === 'image' 
            ? "/api/status/image/{$jobId}"
            : "/api/status/{$jobId}";
        
        $url = $this->baseUrl . $endpoint;
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        if ($this->apiKey) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $this->apiKey
            ]);
        }
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        return json_decode($response, true);
    }

    /**
     * Wait for job completion
     */
    public function waitForCompletion($jobId, $jobType = 'video', $maxAttempts = 60) {
        $interval = 2;
        
        for ($i = 0; $i < $maxAttempts; $i++) {
            $status = $this->getJobStatus($jobId, $jobType);
            
            if ($status['status'] === 'completed') {
                return $status;
            } elseif ($status['status'] === 'failed') {
                throw new Exception('Job failed: ' . $status['message']);
            }
            
            echo "Progress: {$status['progress']}% - {$status['message']}\n";
            sleep($interval);
            
            // Exponential backoff
            $interval = min($interval * 1.5, 30);
        }
        
        throw new Exception('Job timed out');
    }

    /**
     * Download results
     */
    public function downloadResults($jobId, $resultType, $jobType = 'video', $outputPath = null) {
        $endpoint = $jobType === 'image'
            ? "/api/results/image/{$jobId}/{$resultType}"
            : "/api/results/{$jobId}/{$resultType}";
        
        $url = $this->baseUrl . $endpoint;
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        if ($this->apiKey) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $this->apiKey
            ]);
        }
        
        $data = curl_exec($ch);
        curl_close($ch);
        
        if ($outputPath) {
            file_put_contents($outputPath, $data);
            return $outputPath;
        }
        
        return $data;
    }
}

// Example usage
$client = new VoiceDescriptionClient('http://localhost:3000', 'your-api-key');

try {
    // Upload video
    $response = $client->uploadFile('video.mp4', 'video', [
        'detailLevel' => 'comprehensive',
        'voiceId' => 'Joanna'
    ]);
    
    echo "Job ID: {$response['jobId']}\n";
    
    // Wait for completion
    $finalStatus = $client->waitForCompletion($response['jobId']);
    
    // Download results
    $client->downloadResults($response['jobId'], 'text', 'video', 'description.txt');
    $client->downloadResults($response['jobId'], 'audio', 'video', 'narration.mp3');
    
    echo "Processing complete!\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
```

## Shell Script Utilities

```bash
#!/bin/bash

# Voice Description API Shell Client
# Usage: ./vd-api.sh [command] [options]

BASE_URL="${VD_API_URL:-http://localhost:3000}"
API_KEY="${VD_API_KEY:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# API functions
health_check() {
    log_info "Checking API health..."
    
    response=$(curl -s -X GET "${BASE_URL}/api/health")
    status=$(echo "$response" | jq -r '.status')
    
    if [ "$status" = "healthy" ]; then
        log_info "API is healthy"
        echo "$response" | jq '.'
    else
        log_error "API health check failed"
        echo "$response" | jq '.'
        exit 1
    fi
}

upload_file() {
    local file_path="$1"
    local file_type="$2"
    local detail_level="${3:-comprehensive}"
    local voice_id="${4:-Joanna}"
    
    if [ ! -f "$file_path" ]; then
        log_error "File not found: $file_path"
        exit 1
    fi
    
    log_info "Uploading $file_type: $file_path"
    
    response=$(curl -s -X POST "${BASE_URL}/api/upload" \
        -H "Authorization: Bearer ${API_KEY}" \
        -F "file=@${file_path}" \
        -F "type=${file_type}" \
        -F "detailLevel=${detail_level}" \
        -F "voiceId=${voice_id}")
    
    job_id=$(echo "$response" | jq -r '.jobId')
    
    if [ "$job_id" != "null" ]; then
        log_info "Job started: $job_id"
        echo "$job_id"
    else
        log_error "Upload failed"
        echo "$response" | jq '.'
        exit 1
    fi
}

process_image() {
    local image_path="$1"
    local detail_level="${2:-comprehensive}"
    
    if [ ! -f "$image_path" ]; then
        log_error "Image not found: $image_path"
        exit 1
    fi
    
    log_info "Processing image: $image_path"
    
    response=$(curl -s -X POST "${BASE_URL}/api/process-image" \
        -H "Authorization: Bearer ${API_KEY}" \
        -F "file=@${image_path}" \
        -F "detailLevel=${detail_level}" \
        -F "generateAudio=true")
    
    echo "$response" | jq '.'
}

get_status() {
    local job_id="$1"
    local job_type="${2:-video}"
    
    if [ "$job_type" = "image" ]; then
        endpoint="/api/status/image/${job_id}"
    else
        endpoint="/api/status/${job_id}"
    fi
    
    response=$(curl -s -X GET "${BASE_URL}${endpoint}" \
        -H "Authorization: Bearer ${API_KEY}")
    
    echo "$response" | jq '.'
}

wait_for_completion() {
    local job_id="$1"
    local job_type="${2:-video}"
    local max_attempts=60
    local interval=2
    
    log_info "Waiting for job completion: $job_id"
    
    for ((i=1; i<=max_attempts; i++)); do
        response=$(get_status "$job_id" "$job_type")
        status=$(echo "$response" | jq -r '.status')
        progress=$(echo "$response" | jq -r '.progress')
        message=$(echo "$response" | jq -r '.message')
        
        if [ "$status" = "completed" ]; then
            log_info "Job completed!"
            return 0
        elif [ "$status" = "failed" ]; then
            log_error "Job failed: $message"
            return 1
        fi
        
        echo -ne "\rProgress: ${progress}% - ${message}        "
        
        sleep $interval
        # Exponential backoff
        interval=$((interval < 30 ? interval * 2 : 30))
    done
    
    log_error "Job timed out"
    return 1
}

download_results() {
    local job_id="$1"
    local result_type="$2"
    local job_type="${3:-video}"
    local output_file="$4"
    
    if [ "$job_type" = "image" ]; then
        endpoint="/api/results/image/${job_id}/${result_type}"
    else
        endpoint="/api/results/${job_id}/${result_type}"
    fi
    
    log_info "Downloading ${result_type} results..."
    
    curl -s -X GET "${BASE_URL}${endpoint}" \
        -H "Authorization: Bearer ${API_KEY}" \
        -o "$output_file"
    
    if [ $? -eq 0 ]; then
        log_info "Results saved to: $output_file"
    else
        log_error "Download failed"
        return 1
    fi
}

# Main command processing
case "$1" in
    health)
        health_check
        ;;
    
    upload)
        if [ $# -lt 3 ]; then
            echo "Usage: $0 upload <file> <type> [detail_level] [voice_id]"
            exit 1
        fi
        job_id=$(upload_file "$2" "$3" "${4:-comprehensive}" "${5:-Joanna}")
        echo "JOB_ID=$job_id"
        ;;
    
    process-image)
        if [ $# -lt 2 ]; then
            echo "Usage: $0 process-image <image_file> [detail_level]"
            exit 1
        fi
        process_image "$2" "${3:-comprehensive}"
        ;;
    
    status)
        if [ $# -lt 2 ]; then
            echo "Usage: $0 status <job_id> [type]"
            exit 1
        fi
        get_status "$2" "${3:-video}"
        ;;
    
    wait)
        if [ $# -lt 2 ]; then
            echo "Usage: $0 wait <job_id> [type]"
            exit 1
        fi
        wait_for_completion "$2" "${3:-video}"
        ;;
    
    download)
        if [ $# -lt 5 ]; then
            echo "Usage: $0 download <job_id> <result_type> <job_type> <output_file>"
            exit 1
        fi
        download_results "$2" "$3" "$4" "$5"
        ;;
    
    process-video)
        # Complete workflow for video processing
        if [ $# -lt 2 ]; then
            echo "Usage: $0 process-video <video_file> [output_dir]"
            exit 1
        fi
        
        video_file="$2"
        output_dir="${3:-.}"
        
        # Upload
        job_id=$(upload_file "$video_file" "video" "comprehensive" "Joanna")
        
        # Wait
        if wait_for_completion "$job_id" "video"; then
            # Download results
            download_results "$job_id" "text" "video" "${output_dir}/description.txt"
            download_results "$job_id" "audio" "video" "${output_dir}/narration.mp3"
            log_info "Processing complete! Results saved to ${output_dir}/"
        else
            log_error "Processing failed"
            exit 1
        fi
        ;;
    
    batch)
        # Process multiple files
        if [ $# -lt 3 ]; then
            echo "Usage: $0 batch <type> <file1> [file2] ..."
            exit 1
        fi
        
        file_type="$2"
        shift 2
        
        job_ids=()
        
        # Upload all files
        for file in "$@"; do
            if [ -f "$file" ]; then
                job_id=$(upload_file "$file" "$file_type")
                job_ids+=("$job_id:$file")
            else
                log_warning "File not found: $file"
            fi
        done
        
        # Wait and download results
        for job_info in "${job_ids[@]}"; do
            IFS=':' read -r job_id file_name <<< "$job_info"
            base_name=$(basename "$file_name" | cut -d. -f1)
            
            if wait_for_completion "$job_id" "$file_type"; then
                download_results "$job_id" "text" "$file_type" "${base_name}_description.txt"
                if [ "$file_type" = "video" ]; then
                    download_results "$job_id" "audio" "$file_type" "${base_name}_narration.mp3"
                fi
            fi
        done
        
        log_info "Batch processing complete!"
        ;;
    
    *)
        echo "Voice Description API CLI"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  health                      - Check API health"
        echo "  upload <file> <type>        - Upload a file"
        echo "  process-image <file>        - Process an image"
        echo "  status <job_id>             - Get job status"
        echo "  wait <job_id>               - Wait for completion"
        echo "  download <job_id> <type>    - Download results"
        echo "  process-video <file>        - Complete video workflow"
        echo "  batch <type> <files...>     - Batch process files"
        echo ""
        echo "Environment variables:"
        echo "  VD_API_URL                  - API base URL (default: http://localhost:3000)"
        echo "  VD_API_KEY                  - API key for authentication"
        exit 1
        ;;
esac
```

## Advanced Patterns

### Retry Logic with Circuit Breaker

```typescript
class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    constructor(
        private threshold = 5,
        private timeout = 60000, // 1 minute
        private resetTimeout = 120000 // 2 minutes
    ) {}
    
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    private onSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
        }
        this.failures = 0;
    }
    
    private onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        
        if (this.failures >= this.threshold) {
            this.state = 'OPEN';
            setTimeout(() => {
                this.state = 'HALF_OPEN';
            }, this.resetTimeout);
        }
    }
}

// Usage with API client
class ResilientAPIClient extends VoiceDescriptionAPIClient {
    private circuitBreaker = new CircuitBreaker();
    
    async uploadFile(file: File, type: string, options?: ProcessingOptions) {
        return this.circuitBreaker.execute(() => 
            super.uploadFile(file, type, options)
        );
    }
}
```

### Event-Driven Architecture

```javascript
class EventDrivenClient extends EventEmitter {
    constructor(baseUrl) {
        super();
        this.apiClient = new VoiceDescriptionClient(baseUrl);
    }
    
    async processWithEvents(file, type, options) {
        try {
            // Emit upload start
            this.emit('upload:start', { file: file.name });
            
            const uploadResult = await this.apiClient.uploadFile(file, type, options);
            this.emit('upload:complete', uploadResult);
            
            // Poll with events
            const finalStatus = await this.pollWithEvents(uploadResult.jobId, type);
            
            // Download with events
            this.emit('download:start', { jobId: uploadResult.jobId });
            
            const [text, audio] = await Promise.all([
                this.apiClient.downloadResults(uploadResult.jobId, 'text', type),
                this.apiClient.downloadResults(uploadResult.jobId, 'audio', type)
            ]);
            
            this.emit('download:complete', { text, audio });
            this.emit('process:complete', { jobId: uploadResult.jobId, status: finalStatus });
            
            return { text, audio, status: finalStatus };
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    async pollWithEvents(jobId, type) {
        let lastProgress = 0;
        
        return this.apiClient.pollJobStatus(jobId, type, (status) => {
            // Emit progress updates
            if (status.progress > lastProgress) {
                this.emit('progress', {
                    jobId,
                    progress: status.progress,
                    message: status.message,
                    step: status.step
                });
                lastProgress = status.progress;
            }
            
            // Emit step changes
            this.emit(`step:${status.step}`, { jobId, status });
        });
    }
}

// Usage
const client = new EventDrivenClient('http://localhost:3000');

client.on('upload:start', ({ file }) => {
    console.log(`Starting upload: ${file}`);
});

client.on('progress', ({ progress, message }) => {
    console.log(`Progress: ${progress}% - ${message}`);
});

client.on('process:complete', ({ jobId }) => {
    console.log(`Processing complete for job: ${jobId}`);
});

client.on('error', (error) => {
    console.error('Error occurred:', error);
});

// Process file
await client.processWithEvents(file, 'video', { detailLevel: 'comprehensive' });
```

This completes the comprehensive SDK examples and client library implementations for the Voice Description API across multiple programming languages and patterns!