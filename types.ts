
export type JobType = 'Full-time' | 'Part-time' | 'Freelance' | 'Student-friendly';
export type UserRole = 'candidate' | 'employer';

export interface RequirementDetail {
  name: string;
  why: string;
  instruction?: string;
}

export interface Job {
  id: string;
  employerId: string; // The ID of the user who posted the job
  title: string;
  company: string;
  workplace: string;
  type: JobType;
  sector: string;
  salary: string;
  workingHours: string;
  requirements: RequirementDetail[];
  description: string;
  roleDetails: string;
  postedAt: string;
  endDate: string;
  contactEmail: string;
  contactPhone: string;
}

export type ApplicationStatus = 'pending' | 'interview_set' | 'passed' | 'failed_shortlist' | 'failed_interview';

export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatus;
  uploadedDocs: Record<string, string>;
  submittedAt: string;
  verified: boolean;
  candidateName?: string; // For employer view convenience
}
