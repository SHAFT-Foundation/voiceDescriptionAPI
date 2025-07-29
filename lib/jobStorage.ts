// Simple in-memory job storage for development
// In production, this should be replaced with DynamoDB, Redis, or another persistent store

export const jobs = new Map<string, any>();

export function setJob(jobId: string, jobData: any) {
  jobs.set(jobId, jobData);
}

export function getJob(jobId: string) {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, updates: any) {
  const existingJob = jobs.get(jobId);
  if (existingJob) {
    jobs.set(jobId, { ...existingJob, ...updates });
  }
  return jobs.get(jobId);
}

export function listJobs() {
  return Array.from(jobs.entries());
}