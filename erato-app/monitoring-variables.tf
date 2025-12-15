# Variables for Monitoring Setup

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
}

variable "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  type        = string
}

variable "load_balancer_arn_suffix" {
  description = "ARN suffix of the Load Balancer"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "ARN suffix of the Target Group"
  type        = string
}

variable "db_instance_identifier" {
  description = "RDS instance identifier (optional)"
  type        = string
  default     = ""
}

variable "redis_cluster_id" {
  description = "Redis cluster ID (optional)"
  type        = string
  default     = ""
}

variable "pagerduty_integration_url" {
  description = "PagerDuty integration URL (optional)"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts (optional)"
  type        = string
  default     = ""
}