output "cloud_sql_instance_name" {
  description = "The name of the Cloud SQL instance"
  value       = google_sql_database_instance.harness.name
}

output "cloud_sql_private_ip" {
  description = "Private IP of the Cloud SQL instance"
  value       = google_sql_database_instance.harness.private_ip_address
}

output "cloud_run_urls" {
  description = "URLs of deployed Cloud Run services"
  value = {
    for s in local.cloud_run_services :
    s => "https://${s}-${random_id.suffix.hex}-${var.region}.run.app"
  }
}

output "workload_identity_pool" {
  description = "Workload Identity Pool name"
  value       = google_iam_workload_identity_pool.github_pool.name
}

output "workload_identity_provider" {
  description = "Workload Identity Provider name"
  value       = google_iam_workload_identity_pool_provider.github_provider.name
}

output "service_accounts" {
  description = "Email of each Cloud Run service account"
  value = {
    for s in local.cloud_run_services :
    s => google_service_account.cloud_run_sa[s].email
  }
}
