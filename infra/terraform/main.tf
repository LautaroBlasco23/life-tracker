# Life Tracker — AWS infrastructure, mirroring infra/scripts/*.sh
# (provision.sh, deploy-lambda.sh, deploy-frontend.sh).
#
# The same AWS API calls run locally against floci (infra/docker-compose.yml):
#   floci-up -> floci-provision -> floci-deploy -> deploy-frontend
#
# To use against floci, add to the provider block:
#   endpoints = ["http://localhost:4566"]
#   skip_credentials_validation = true
#   skip_requesting_account_id = true
#   s3_use_path_style = true
#
# Sensitive values (db_password, docdb_password, jwt_secret) must come from a
# terraform.tfvars file or environment — never commit them.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region"    { default = "us-east-1" }
variable "db_password"   { sensitive = true }
variable "docdb_password" { sensitive = true }
variable "jwt_secret"    { sensitive = true }   # provision.sh: generated once, reused

# --- S3: user images + frontend artifact ---
resource "aws_s3_bucket" "images" {
  bucket = "lifetracker-images"
}
resource "aws_s3_bucket" "web" {
  bucket = "lifetracker-web"
}

# --- Secrets Manager: JWT signing key ---
resource "aws_secretsmanager_secret" "jwt" {
  name = "life-tracker/jwt-secret"
}
resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = var.jwt_secret
}

# --- RDS PostgreSQL (floci: real postgres:16-alpine container) ---
resource "aws_db_instance" "postgres" {
  identifier          = "lifetracker-postgres"
  engine              = "postgres"
  engine_version      = "16"
  instance_class      = "db.t3.micro"
  allocated_storage   = 20
  db_name             = "life_tracker"
  username            = "postgres"
  password            = var.db_password
  skip_final_snapshot = true
}

# --- DocumentDB, Mongo-compatible (floci: real mongo:7.0 container) ---
resource "aws_docdb_cluster" "docdb" {
  cluster_identifier  = "lifetracker-docdb"
  engine              = "docdb"
  engine_version      = "7.0"
  master_username     = "root"
  master_password     = var.docdb_password
  skip_final_snapshot = true
}

# --- Lambda: Go API compiled to a bootstrap binary (deploy-lambda.sh) ---
resource "aws_lambda_function" "api" {
  function_name = "lifetracker-api"
  # Built by infra/scripts/deploy-lambda.sh: go build -o bootstrap && zip
  # Add source_code_hash = filebase64sha256("lifetracker-lambda.zip") to
  # redeploy on zip changes (zip must exist before plan).
  filename    = "lifetracker-lambda.zip"
  runtime     = "provided.al2"
  handler     = "bootstrap"
  timeout     = 60
  memory_size = 512
  role        = aws_iam_role.lambda.arn

  environment {
    variables = {
      ENVIRONMENT         = "dev"
      APP_RUNTIME         = "serverless"
      DB_HOST             = aws_db_instance.postgres.address
      DB_PORT             = aws_db_instance.postgres.port
      DB_USER             = aws_db_instance.postgres.username
      DB_PASSWORD         = var.db_password
      DB_NAME             = aws_db_instance.postgres.db_name
      DB_SSLMODE          = "disable"
      MONGO_URI           = "mongodb://root:${var.docdb_password}@${aws_docdb_cluster.docdb.endpoint}:${aws_docdb_cluster.docdb.port}"
      MONGO_DATABASE      = "life_tracker"
      JWT_SECRET          = var.jwt_secret
      JWT_EXPIRY          = "15m"
      JWT_REFRESH_EXPIRY  = "168h"
      S3_BUCKET           = aws_s3_bucket.images.bucket
      S3_PUBLIC_URL       = aws_s3_bucket.images.bucket_regional_domain_name
      SECRETS_JWT_NAME    = aws_secretsmanager_secret.jwt.name
      CORS_ALLOWED_ORIGINS = "*"
    }
  }
}

# Lambda execution role (deploy-lambda.sh uses a dummy arn in floci;
# real AWS needs managed policies: AWSLambdaBasicExecutionRole + S3/Secrets
# Manager access as required by the app).
resource "aws_iam_role" "lambda" {
  name = "lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# --- API Gateway v2 (HTTP): ANY /{proxy+} -> Lambda ---
resource "aws_apigatewayv2_api" "api" {
  name          = "lifetracker-api"
  protocol_type = "HTTP"
}
resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}
resource "aws_apigatewayv2_stage" "dev" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "dev"
  auto_deploy = true
}

# --- CloudFront: serves the static export from S3 (nginx is the local stand-in) ---
resource "aws_cloudfront_distribution" "web" {
  enabled = true
  origin {
    domain_name = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id   = "lifetracker-web-origin"
  }
  default_cache_behavior {
    target_origin_id       = "lifetracker-web-origin"
    viewer_protocol_policy = "allow-all"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values {
      query_string = false
      cookies      = { forward = "none" }
    }
    min_ttl     = 0
    default_ttl = 86400
  }
}
