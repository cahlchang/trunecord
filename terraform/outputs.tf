# API Gateway URL
output "api_url" {
  value       = aws_api_gateway_stage.auth_api.invoke_url
  description = "The API Gateway URL for the authentication server"
}

# Lambda function name
output "lambda_function_name" {
  value       = aws_lambda_function.auth_api.function_name
  description = "The name of the Lambda function"
}

# Lambda function ARN
output "lambda_function_arn" {
  value       = aws_lambda_function.auth_api.arn
  description = "The ARN of the Lambda function"
}

# CloudWatch Log Group
output "cloudwatch_log_group" {
  value       = aws_cloudwatch_log_group.lambda_logs.name
  description = "The CloudWatch log group name"
}

# API Gateway ID
output "api_gateway_id" {
  value       = aws_api_gateway_rest_api.auth_api.id
  description = "The API Gateway REST API ID"
}

# Full OAuth redirect URI
output "oauth_redirect_uri" {
  value       = "${aws_api_gateway_stage.auth_api.invoke_url}/api/callback"
  description = "The OAuth redirect URI to configure in Discord"
}