# Erato Backend Infrastructure - Terraform Configuration
# This sets up a highly available, auto-scaling backend infrastructure on AWS

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC and Networking
resource "aws_vpc" "erato_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "erato-vpc"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_subnet" "erato_subnet_a" {
  vpc_id            = aws_vpc.erato_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name        = "erato-subnet-a"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_subnet" "erato_subnet_b" {
  vpc_id            = aws_vpc.erato_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name        = "erato-subnet-b"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_internet_gateway" "erato_igw" {
  vpc_id = aws_vpc.erato_vpc.id

  tags = {
    Name        = "erato-igw"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_route_table" "erato_rt" {
  vpc_id = aws_vpc.erato_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.erato_igw.id
  }

  tags = {
    Name        = "erato-rt"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_route_table_association" "erato_rta_a" {
  subnet_id      = aws_subnet.erato_subnet_a.id
  route_table_id = aws_route_table.erato_rt.id
}

resource "aws_route_table_association" "erato_rta_b" {
  subnet_id      = aws_subnet.erato_subnet_b.id
  route_table_id = aws_route_table.erato_rt.id
}

# Security Groups
resource "aws_security_group" "erato_backend_sg" {
  name_prefix = "erato-backend-"
  vpc_id      = aws_vpc.erato_vpc.id

  # SSH access (restrict to your IP)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  # HTTP access (from load balancer)
  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.erato_alb_sg.id]
  }

  # HTTPS access (from load balancer)
  ingress {
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.erato_alb_sg.id]
  }

  # Allow all outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "erato-backend-sg"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_security_group" "erato_alb_sg" {
  name_prefix = "erato-alb-"
  vpc_id      = aws_vpc.erato_vpc.id

  # HTTP access
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "erato-alb-sg"
    Environment = "production"
    Application = "erato"
  }
}

# Application Load Balancer
resource "aws_lb" "erato_alb" {
  name               = "erato-backend-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.erato_alb_sg.id]
  subnets            = [aws_subnet.erato_subnet_a.id, aws_subnet.erato_subnet_b.id]

  enable_deletion_protection = false

  tags = {
    Name        = "erato-backend-alb"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_lb_target_group" "erato_tg" {
  name     = "erato-backend-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.erato_vpc.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = {
    Name        = "erato-backend-tg"
    Environment = "production"
    Application = "erato"
  }
}

resource "aws_lb_listener" "erato_listener" {
  load_balancer_arn = aws_lb.erato_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.erato_tg.arn
  }
}

# Launch Template
resource "aws_launch_template" "erato_lt" {
  name_prefix   = "erato-backend-"
  image_id      = var.ami_id
  instance_type = var.instance_type
  key_name      = var.key_pair_name

  vpc_security_group_ids = [aws_security_group.erato_backend_sg.id]

  user_data = base64encode(templatefile("${path.module}/user-data.sh.tpl", {
    supabase_url         = var.supabase_url
    supabase_service_key = var.supabase_service_key
    supabase_anon_key    = var.supabase_anon_key
    jwt_secret          = var.jwt_secret
    frontend_url        = var.frontend_url
    aws_access_key_id   = var.aws_access_key_id
    aws_secret_access_key = var.aws_secret_access_key
    aws_s3_bucket       = var.aws_s3_bucket
    aws_region          = var.aws_region
  }))

  monitoring {
    enabled = true
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "erato-backend"
      Environment = "production"
      Application = "erato"
    }
  }

  tag_specifications {
    resource_type = "volume"
    tags = {
      Name        = "erato-backend"
      Environment = "production"
      Application = "erato"
    }
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "erato_asg" {
  name                = "erato-backend-asg"
  desired_capacity    = var.desired_instances
  max_size            = var.max_instances
  min_size            = var.min_instances
  target_group_arns   = [aws_lb_target_group.erato_tg.arn]
  vpc_zone_identifier = [aws_subnet.erato_subnet_a.id, aws_subnet.erato_subnet_b.id]

  launch_template {
    id      = aws_launch_template.erato_lt.id
    version = "$Latest"
  }

  health_check_type         = "ELB"
  health_check_grace_period = 300

  tag {
    key                 = "Name"
    value               = "erato-backend"
    propagate_at_launch = true
  }

  tag {
    key                 = "Environment"
    value               = "production"
    propagate_at_launch = true
  }

  tag {
    key                 = "Application"
    value               = "erato"
    propagate_at_launch = true
  }
}

# Scaling Policies
resource "aws_autoscaling_policy" "scale_out" {
  name                   = "erato-scale-out"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.erato_asg.name
}

resource "aws_autoscaling_policy" "scale_in" {
  name                   = "erato-scale-in"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.erato_asg.name
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "erato-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "70"
  alarm_description   = "Scale out when CPU > 70%"
  alarm_actions       = [aws_autoscaling_policy.scale_out.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.erato_asg.name
  }
}

resource "aws_cloudwatch_metric_alarm" "low_cpu" {
  alarm_name          = "erato-low-cpu"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "30"
  alarm_description   = "Scale in when CPU < 30%"
  alarm_actions       = [aws_autoscaling_policy.scale_in.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.erato_asg.name
  }
}

# Outputs
output "load_balancer_dns" {
  description = "DNS name of the load balancer"
  value       = aws_lb.erato_alb.dns_name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.erato_vpc.id
}

output "auto_scaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = aws_autoscaling_group.erato_asg.name
}