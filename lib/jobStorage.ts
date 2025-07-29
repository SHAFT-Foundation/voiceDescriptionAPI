// File-based job storage for development (persists between serverless function calls)
// In production, this should be replaced with DynamoDB, Redis, or another persistent store

import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), '.job-storage.json');

function loadJobs(): Map<string, any> {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf8');
      const jobsArray = JSON.parse(data);
      return new Map(jobsArray);
    }
  } catch (error) {
    console.warn('Failed to load jobs from storage:', error);
  }
  return new Map();
}

function saveJobs(jobs: Map<string, any>) {
  try {
    const jobsArray = Array.from(jobs.entries());
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(jobsArray, null, 2));
  } catch (error) {
    console.error('Failed to save jobs to storage:', error);
  }
}

export function setJob(jobId: string, jobData: any) {
  const jobs = loadJobs();
  jobs.set(jobId, jobData);
  saveJobs(jobs);
}

export function getJob(jobId: string) {
  const jobs = loadJobs();
  return jobs.get(jobId);
}

export function updateJob(jobId: string, updates: any) {
  const jobs = loadJobs();
  const existingJob = jobs.get(jobId);
  if (existingJob) {
    const updatedJob = { ...existingJob, ...updates };
    jobs.set(jobId, updatedJob);
    saveJobs(jobs);
    return updatedJob;
  }
  return null;
}

export function listJobs() {
  const jobs = loadJobs();
  return Array.from(jobs.entries());
}