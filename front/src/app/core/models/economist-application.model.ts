import { EconomistStatus } from '../enums/economist-status.enum';
import { ExpertiseArea } from '../enums/expertise-area.enum';
import { EconomistApplicationLink, EconomistApplicationLinkRequest } from './economist-application-link.model';

export interface EconomistApplication {
  id: number;
  applicantUserId: string;
  fullName: string;
  phone: string;
  biography: string;
  yearsOfExperience: number;
  education: string;
  currentTitle?: string;
  institution?: string;
  expertiseAreas: ExpertiseArea[];
  licensesAndCertificates: string[];
  links: EconomistApplicationLink[];
  status: EconomistStatus;
  adminDecisionNote?: string;
  submittedAtUtc: string;
  reviewedAtUtc?: string;
}

export interface SubmitEconomistApplicationRequest {
  fullName: string;
  phone: string;
  biography: string;
  yearsOfExperience: number;
  education: string;
  currentTitle?: string;
  institution?: string;
  expertiseAreas: ExpertiseArea[];
  licensesAndCertificates: string[];
  links: EconomistApplicationLinkRequest[];
}

export interface AdminReviewApplicationRequest {
  decision: 'Approve' | 'Reject';
  note?: string;
}

export interface PagedEconomistApplicationsResult {
  items: EconomistApplication[];
  totalCount: number;
  page: number;
  pageSize: number;
}
