export const EligibilityType = {
  ALL: "ALL",
  DELIVERED_ONLY: "DELIVERED_ONLY",
  NON_DELIVERED_ONLY: "NON_DELIVERED_ONLY",
} as const;
export type EligibilityType = (typeof EligibilityType)[keyof typeof EligibilityType];

export const ServiceCategory = {
  MAINTENANCE: "MAINTENANCE",
  RECREATION: "RECREATION",
  FITNESS: "FITNESS",
  SECURITY: "SECURITY",
  ADMIN: "ADMIN",
  REQUESTS: "REQUESTS",
  FACILITIES: "FACILITIES",
  OTHER: "OTHER",
} as const;
export type ServiceCategory = (typeof ServiceCategory)[keyof typeof ServiceCategory];

export const PermitCategory = {
  ACCOUNT_INFO: "ACCOUNT_INFO",
  LEGAL_OWNERSHIP: "LEGAL_OWNERSHIP",
  UTILITIES_SERVICES: "UTILITIES_SERVICES",
  COMMUNITY_ACTIVITIES: "COMMUNITY_ACTIVITIES",
  OPERATIONAL: "OPERATIONAL",
} as const;
export type PermitCategory = (typeof PermitCategory)[keyof typeof PermitCategory];

export const ServiceFieldType = {
  TEXT: "TEXT",
  TEXTAREA: "TEXTAREA",
  NUMBER: "NUMBER",
  DATE: "DATE",
  BOOLEAN: "BOOLEAN",
  MEMBER_SELECTOR: "MEMBER_SELECTOR",
  FILE: "FILE",
} as const;
export type ServiceFieldType = (typeof ServiceFieldType)[keyof typeof ServiceFieldType];

export const InvoiceStatus = {
  PAID: "PAID",
  PENDING: "PENDING",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const ComplaintStatus = {
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
} as const;
export type ComplaintStatus = (typeof ComplaintStatus)[keyof typeof ComplaintStatus];

export const Priority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const ViolationStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  APPEALED: "APPEALED",
  CANCELLED: "CANCELLED",
} as const;
export type ViolationStatus = (typeof ViolationStatus)[keyof typeof ViolationStatus];

export const FacilityType = {
  GYM: "GYM",
  POOL: "POOL",
  TENNIS_COURT: "TENNIS_COURT",
  MULTIPURPOSE_HALL: "MULTIPURPOSE_HALL",
  CUSTOM: "CUSTOM",
} as const;
export type FacilityType = (typeof FacilityType)[keyof typeof FacilityType];

export const BookingStatus = {
  PENDING: "PENDING",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  APPROVED: "APPROVED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const BillingCycle = {
  NONE: "NONE",
  PER_HOUR: "PER_HOUR",
  PER_SLOT: "PER_SLOT",
  PER_USE: "PER_USE",
} as const;
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export const ViolationActionType = {
  APPEAL: "APPEAL",
  FIX_SUBMISSION: "FIX_SUBMISSION",
} as const;
export type ViolationActionType = (typeof ViolationActionType)[keyof typeof ViolationActionType];

export const ViolationActionStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CLOSED: "CLOSED",
} as const;
export type ViolationActionStatus = (typeof ViolationActionStatus)[keyof typeof ViolationActionStatus];

export const ServiceRequestStatus = {
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const;
export type ServiceRequestStatus = (typeof ServiceRequestStatus)[keyof typeof ServiceRequestStatus];

export const PermitStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type PermitStatus = (typeof PermitStatus)[keyof typeof PermitStatus];

export const SurveyStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
} as const;
export type SurveyStatus = (typeof SurveyStatus)[keyof typeof SurveyStatus];

export const SurveyTarget = {
  ALL: "ALL",
  SPECIFIC_COMMUNITIES: "SPECIFIC_COMMUNITIES",
  SPECIFIC_UNITS: "SPECIFIC_UNITS",
} as const;
export type SurveyTarget = (typeof SurveyTarget)[keyof typeof SurveyTarget];

export const SurveyFieldType = {
  TEXT: "TEXT",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  RATING: "RATING",
  YES_NO: "YES_NO",
} as const;
export type SurveyFieldType = (typeof SurveyFieldType)[keyof typeof SurveyFieldType];

export const OrderStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
