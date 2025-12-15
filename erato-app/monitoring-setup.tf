# Monitoring and Alerting Setup for Erato Backend
# This Terraform configuration sets up comprehensive monitoring with CloudWatch

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "erato_alerts" {
  name = "erato-backend-alerts"

  tags = {
    Name        = "erato-alerts"
    Environment = "production"
    Application = "erato"
  }
}

# SNS Topic Policy
resource "aws_sns_topic_policy" "erato_alerts_policy" {
  arn = aws_sns_topic.erato_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action = [
          "SNS:Publish"
        ]
        Resource = aws_sns_topic.erato_alerts.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# Email subscription for alerts (replace with your email)
resource "aws_sns_topic_subscription" "erato_alerts_email" {
  topic_arn = aws_sns_topic.erato_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Data source for current account
data "aws_caller_identity" "current" {}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "erato_dashboard" {
  dashboard_name = "erato-backend-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # CPU Utilization
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", var.autoscaling_group_name, { "stat": "Average", "period": 300 }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "EC2 CPU Utilization"
          period  = 300
        }
      },
      # Memory Utilization
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["System/Linux", "MemoryUtilization", "AutoScalingGroupName", var.autoscaling_group_name, { "stat": "Average", "period": 300 }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Memory Utilization"
          period  = 300
        }
      },
      # ALB Request Count
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.load_balancer_arn_suffix, { "stat": "Sum", "period": 300 }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ALB Request Count"
          period  = 300
        }
      },
      # ALB Target Response Time
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.load_balancer_arn_suffix, { "stat": "Average", "period": 300 }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Target Response Time"
          period  = 300
        }
      },
      # Database Connections
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.db_instance_identifier, { "stat": "Average", "period": 300 }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Database Connections"
          period  = 300
        }
      },
      # Redis Connections
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CurrConnections", "CacheClusterId", var.redis_cluster_id, { "stat": "Average", "period": 300 }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Redis Connections"
          period  = 300
        }
      },
      # Error Rates
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 24
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.load_balancer_arn_suffix, { "stat": "Sum", "period": 300 }],
            [".", "HTTPCode_Target_4XX_Count", ".", ".", { "stat": "Sum", "period": 300 }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "HTTP Error Rates (4XX and 5XX)"
          period  = 300
        }
      }
    ]
  })
}

# Critical Alerts
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "erato-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "CPU utilization is above 80% for 15 minutes"
  alarm_actions       = [aws_sns_topic.erato_alerts.arn]

  dimensions = {
    AutoScalingGroupName = var.autoscaling_group_name
  }

  tags = {
    Name        = "erato-high-cpu"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_memory" {
  alarm_name          = "erato-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "System/Linux"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "Memory utilization is above 85% for 10 minutes"
  alarm_actions       = [aws_sns_topic.erato_alerts.arn]

  dimensions = {
    AutoScalingGroupName = var.autoscaling_group_name
  }

  tags = {
    Name        = "erato-high-memory"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "erato-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "1"
  alarm_description   = "Load balancer has unhealthy hosts"
  alarm_actions       = [aws_sns_topic.erato_alerts.arn]

  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  tags = {
    Name        = "erato-unhealthy-hosts"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_5xx_errors" {
  alarm_name          = "erato-high-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "High number of 5XX errors detected"
  alarm_actions       = [aws_sns_topic.erato_alerts.arn]

  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
  }

  tags = {
    Name        = "erato-high-5xx-errors"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  alarm_name          = "erato-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"
  alarm_description   = "Response time is above 5 seconds"
  alarm_actions       = [aws_sns_topic.erato_alerts.arn]

  dimensions = {
    LoadBalancer = var.load_balancer_arn_suffix
  }

  tags = {
    Name        = "erato-high-response-time"
    Environment = "production"
    Application = "erato"
  }
}

# Application Performance Monitoring (APM)
resource "aws_cloudwatch_metric_alarm" "db_connection_limit" {
  count               = var.db_instance_identifier != "" ? 1 : 0
  alarm_name          = "erato-db-connection-limit"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "80"  # 80% of max connections
  alarm_description   = "Database approaching connection limit"
  alarm_actions       = [aws_sns_topic.erato_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }

  tags = {
    Name        = "erato-db-connection-limit"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_connection_limit" {
  count               = var.redis_cluster_id != "" ? 1 : 0
  alarm_name          = "erato-redis-connection-limit"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "1000"
  alarm_description   = "Redis has high connection count"
  alarm_actions       = [aws_sns_topic.erato_alerts.arn]

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  tags = {
    Name        = "erato-redis-connection-limit"
    Environment = "production"
    Application = "erato"
  }
}

# Log Groups for Application Logs
resource "aws_cloudwatch_log_group" "erato_app_logs" {
  name              = "/erato/backend/application"
  retention_in_days = 30

  tags = {
    Name        = "erato-app-logs"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_cloudwatch_log_group" "erato_error_logs" {
  name              = "/erato/backend/errors"
  retention_in_days = 90

  tags = {
    Name        = "erato-error-logs"
    Environment = "production"
    Application = "erato"
  }
}

# CloudWatch Agent Configuration for EC2 instances
resource "aws_ssm_parameter" "cloudwatch_config" {
  name  = "/erato/cloudwatch-config"
  type  = "String"
  value = jsonencode({
    logs = {
      logs_collected = {
        files = {
          collect_list = [
            {
              file_path        = "/home/ec2-user/erato-app/logs/*.log"
              log_group_name   = "/erato/backend/application"
              log_stream_name  = "{instance_id}"
              timestamp_format = "%Y-%m-%d %H:%M:%S"
            },
            {
              file_path        = "/home/ec2-user/erato-app/logs/error.log"
              log_group_name   = "/erato/backend/errors"
              log_stream_name  = "{instance_id}"
              timestamp_format = "%Y-%m-%d %H:%M:%S"
            }
          ]
        }
      }
    }
    metrics = {
      metrics_collected = {
        mem = {
          measurement = ["mem_used_percent"]
        }
        disk = {
          measurement = ["disk_used_percent"]
          resources   = ["/"]
        }
        cpu = {
          measurement = ["cpu_usage_active"]
        }
      }
    }
  })

  tags = {
    Name        = "erato-cloudwatch-config"
    Environment = "production"
    Application = "erato"
  }
}

# PagerDuty Integration (optional)
resource "aws_sns_topic_subscription" "erato_pagerduty" {
  count     = var.pagerduty_integration_url != "" ? 1 : 0
  topic_arn = aws_sns_topic.erato_alerts.arn
  protocol  = "https"
  endpoint  = var.pagerduty_integration_url
}

# Slack Integration (optional)
resource "aws_sns_topic_subscription" "erato_slack" {
  count     = var.slack_webhook_url != "" ? 1 : 0
  topic_arn = aws_sns_topic.erato_alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}