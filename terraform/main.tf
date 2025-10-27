terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }

  # Local backend for now - uncomment below for S3 backend
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "trunecord/terraform.tfstate"
  #   region = "ap-northeast-1"
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null
}

# Lambda function
resource "aws_lambda_function" "auth_api" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.project_name}-auth-api"
  role             = aws_iam_role.lambda_execution.arn
  handler          = "lambda.handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      DISCORD_CLIENT_ID         = var.discord_client_id
      DISCORD_CLIENT_SECRET     = var.discord_client_secret
      DISCORD_BOT_TOKEN         = var.discord_bot_token
      REDIRECT_URI              = "https://${aws_api_gateway_rest_api.auth_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}/api/callback"
      FRONTEND_URL              = var.frontend_url
      JWT_SECRET                = var.jwt_secret
      ENABLE_BOT_TOKEN_ENDPOINT = var.enable_bot_token_endpoint
      GO_CLIENT_LATEST_VERSION  = var.go_client_latest_version
      GO_CLIENT_MIN_VERSION     = var.go_client_min_version
      GO_CLIENT_DOWNLOAD_URL    = var.go_client_download_url
      GO_CLIENT_RELEASE_NOTES   = var.go_client_release_notes
      EXTENSION_LATEST_VERSION  = var.extension_latest_version
      EXTENSION_MIN_VERSION     = var.extension_min_version
      EXTENSION_DOWNLOAD_URL    = var.extension_download_url
      EXTENSION_RELEASE_NOTES   = var.extension_release_notes
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_logs,
    aws_cloudwatch_log_group.lambda_logs
  ]
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-auth-api"
  retention_in_days = 14
}

# API Gateway
resource "aws_api_gateway_rest_api" "auth_api" {
  name        = "${var.project_name}-auth-api"
  description = "Authentication API for Music to Discord"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "auth_api" {
  rest_api_id = aws_api_gateway_rest_api.auth_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_rest_api.auth_api.root_resource_id,
      aws_api_gateway_method.proxy_root,
      aws_api_gateway_method.proxy,
      aws_api_gateway_integration.lambda_root,
      aws_api_gateway_integration.lambda,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "auth_api" {
  deployment_id = aws_api_gateway_deployment.auth_api.id
  rest_api_id   = aws_api_gateway_rest_api.auth_api.id
  stage_name    = var.environment
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.auth_api.execution_arn}/*/*"
}
