resource "google_sql_database_instance" "spoke" {
  name             = "spoke-dev-${random_id.suffix.hex}"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier                        = "db-custom-1-3840"
    enable_dataplex_integration = false

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_service_networking_connection.private_vpc_connection.network
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }

  deletion_protection = false
}

resource "google_sql_database" "spoke_dev" {
  name     = "spoke_dev"
  instance = google_sql_database_instance.spoke.name
}

resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "google_sql_user" "spoke" {
  name     = "spoke"
  instance = google_sql_database_instance.spoke.name
  password = var.db_password != "" ? var.db_password : random_password.db_password.result
}

resource "google_compute_network" "spoke_vpc" {
  name                    = "spoke-dev-vpc"
  auto_create_subnetworks = true
}

resource "google_compute_global_address" "private_ip_block" {
  name          = "spoke-dev-private-ip-block"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.spoke_vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.spoke_vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_block.name]
}

resource "random_id" "suffix" {
  byte_length = 4
}
