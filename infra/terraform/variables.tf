variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "db_password" {
  description = "Cloud SQL Postgres password"
  type        = string
  sensitive   = true
}

variable "github_org" {
  description = "GitHub organization for workload identity federation"
  type        = string
  default     = "anomalyco"
}

variable "github_repo" {
  description = "GitHub repository for workload identity federation"
  type        = string
  default     = "spoke"
}

variable "image_tag" {
  description = "Container image tag for deployments"
  type        = string
  default     = "latest"
}

variable "database_url" {
  description = "Postgres connection string (e.g. postgresql://user:pass@host:5432/db)"
  type        = string
  sensitive   = true
}

variable "temporal_namespace" {
  description = "Temporal Cloud namespace"
  type        = string
  default     = "default"
}

variable "temporal_address" {
  description = "Temporal Cloud gRPC address (host:port)"
  type        = string
}
